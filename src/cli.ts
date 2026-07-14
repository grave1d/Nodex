#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { emitKeypressEvents } from 'node:readline';
import pino from 'pino';
import { loadConfig } from './config.js';
import { browserAuth, manualAuth } from './auth/browser.js';
import type { Credentials } from './auth/credentials.js';
import {
  dashboardAction,
  defaultConsoleLogPath,
  defaultConsoleSettingsPath,
  loadConsoleLanguage,
  prepareConsoleLogFile,
  renderDashboard,
  saveConsoleLanguage,
  shouldUseInteractiveConsole,
  toggleConsoleLanguage,
  type DashboardState,
} from './console/dashboard.js';
import { NodexError } from './errors.js';
import { InternalNotionTransport } from './transport/notion.js';
import { MockTransport } from './transport/mock.js';
import { AutoReauthTransport } from './transport/reauth.js';
import { SessionStore } from './session/store.js';
import { buildServer, serverLoggerOptions } from './server.js';
import { generateProtocolPreamble } from './protocol/preamble.js';
import { assertCompleteTurn, parseProtocol } from './protocol/parser.js';
import { cliHelp, resolveCliInvocation, shouldUseSetupWizard } from './cli-routing.js';
import { diagnosticLines, diagnoseAgentBindings } from './setup/diagnostics.js';
import { loadLocalEnv } from './setup/files.js';
import { runSetupWizard } from './setup/wizard.js';

async function collect(chunks: AsyncIterable<string>): Promise<string> { let text = ''; for await (const chunk of chunks) text += chunk; return text; }
async function preflightWithRetry(transport: InternalNotionTransport, credentials?: Credentials) {
  for (let attempt = 0; ; attempt += 1) {
    try { return await transport.preflight(credentials); }
    catch (error) {
      if (!(error instanceof NodexError) || error.code !== 'network' || attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}
function assertLiveFinal(raw: string, marker: string): void {
  const events = parseProtocol(raw).events;
  assertCompleteTurn(events);
  const terminal = events.at(-1);
  if (terminal?.type !== 'final' || !terminal.text.includes(marker)) throw new Error(`Live agent did not return expected final marker: ${marker}`);
}

async function doctor(live: boolean): Promise<void> {
  await loadLocalEnv();
  const config = await loadConfig(undefined, { onWarning: (warning) => { console.warn(warning); } });
  const transport = new InternalNotionTransport();
  const info = await preflightWithRetry(transport);
  console.log(`OK: ${info.userName || info.userEmail} — ${info.workspaceName}`);
  const agents = await transport.discoverCustomAgents();
  const diagnostics = diagnoseAgentBindings(config, agents);
  for (const line of diagnosticLines(diagnostics)) console.log(line);
  if (!diagnostics.length || diagnostics.some((diagnostic) => diagnostic.kind !== 'ok')) {
    throw new Error('Doctor found configuration errors. Run: nodex setup');
  }
  if (live) {
    console.log('LIVE: this creates a Notion thread and may use Notion AI quota.');
    const binding = Object.values(config.models)[0];
    if (!binding) throw new Error('No models configured for live test');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), config.turnTimeoutMs);
    try {
      const threadId = randomUUID();
      const first = await transport.send({ threadId, newThread: true, state: '{}', agent: binding, signal: controller.signal, attachments: [], message: `${generateProtocolPreamble()}\n\nTOOLS hash=doctor []\nTOOL_CHOICE "none"\nINPUT\nNodex connection test. Reply with OK.` });
      const firstText = await collect(first.chunks); assertLiveFinal(firstText, 'OK');
      const second = await transport.send({ threadId, newThread: false, state: first.nextState, agent: binding, signal: controller.signal, attachments: [], message: 'TOOLS hash=doctor\nTOOL_CHOICE "none"\nINPUT\nNodex connection test. Reply with OK.' });
      const secondText = await collect(second.chunks); assertLiveFinal(secondText, 'OK');
      console.log(`LIVE OK: thread ${threadId} created and continued`);
    } finally { clearTimeout(timer); }
  }
}

async function serve(args: string[]): Promise<void> {
  await loadLocalEnv();
  const config = await loadConfig(undefined, { onWarning: (warning) => { console.warn(warning); } });
  const interactive = shouldUseInteractiveConsole({
    args,
    env: process.env,
    stdinIsTTY: process.stdin.isTTY,
    stdoutIsTTY: process.stdout.isTTY,
  });
  const settingsPath = resolve(process.env['NODEX_UI_CONFIG'] ?? defaultConsoleSettingsPath());
  const logPath = resolve(process.env['NODEX_LOG_PATH'] ?? defaultConsoleLogPath());
  if (interactive) await prepareConsoleLogFile(logPath);
  const destination = interactive
    ? pino.destination({ dest: logPath, mkdir: true, sync: false })
    : undefined;
  const logger = destination ? pino(serverLoggerOptions(config), destination) : undefined;
  const store = new SessionStore(config.databasePath);
  const baseTransport = config.transport === 'mock' ? new MockTransport() : new InternalNotionTransport();
  const transport = config.auth.autoReauth ? new AutoReauthTransport(baseTransport) : baseTransport;
  const app = buildServer(config, store, transport, logger ? { logger } : {});
  let finish: (() => void) | undefined;
  const finished = new Promise<void>((resolveFinished) => { finish = resolveFinished; });
  let state: DashboardState | undefined;
  let keypress: ((sequence: string, key: { name?: string; sequence?: string; ctrl?: boolean }) => void) | undefined;
  let stopping: Promise<void> | undefined;

  const paint = (): void => {
    if (!state) return;
    process.stdout.write(`\u001b[2J\u001b[H${renderDashboard(state, !('NO_COLOR' in process.env))}`);
  };

  const removeListeners = (): void => {
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    if (keypress) process.stdin.removeListener('keypress', keypress);
    if (interactive) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
  };

  const shutdown = (): Promise<void> => {
    if (stopping) return stopping;
    stopping = (async () => {
      if (state) {
        state.health = 'stopping';
        paint();
      }
      removeListeners();
      try {
        await app.close();
      } catch (error) {
        app.log.error({ err: error }, 'Nodex shutdown failed');
      } finally {
        store.close();
        if (destination) {
          logger?.flush();
          destination.flushSync();
          destination.end();
        }
        if (interactive) process.stdout.write('\n');
        finish?.();
      }
    })();
    return stopping;
  };

  const onSignal = (): void => { void shutdown(); };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  try {
    const address = await app.listen(config.server);
    if (interactive) {
      state = {
        language: await loadConsoleLanguage(settingsPath),
        health: 'ready',
        notion: 'unchecked',
        address,
        bindings: Object.entries(config.models).map(([id, binding]) => ({
          id,
          agentName: binding.agentName,
          notionModel: binding.notionModel,
        })),
        logPath,
        showHelp: false,
      };
      paint();
      emitKeypressEvents(process.stdin);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      keypress = (sequence, key): void => {
        const action = dashboardAction({ ...key, sequence: key.sequence ?? sequence });
        if (!state || action === 'none') return;
        if (action === 'quit') {
          void shutdown();
          return;
        }
        if (action === 'help') state.showHelp = !state.showHelp;
        if (action === 'language') {
          state.language = toggleConsoleLanguage(state.language);
          void saveConsoleLanguage(state.language, settingsPath).catch((error: unknown) => {
            app.log.warn({ err: error }, 'Cannot save console language');
          });
        }
        if (action === 'refresh' && state.health !== 'checking') {
          state.health = 'checking';
          paint();
          void app.inject({ method: 'GET', url: '/healthz?deep=1' })
            .then((response) => {
              if (!state || stopping) return;
              state.health = response.statusCode === 200 ? 'ready' : 'error';
              state.notion = response.statusCode === 200 ? 'ok' : 'error';
              paint();
            })
            .catch((error: unknown) => {
              if (!state || stopping) return;
              state.health = 'error';
              state.notion = 'error';
              app.log.warn({ err: error }, 'Dashboard health check failed');
              paint();
            });
          return;
        }
        paint();
      };
      process.stdin.on('keypress', keypress);
    }
  } catch (error) {
    await shutdown();
    throw error;
  }

  await finished;
}

async function main(): Promise<void> {
  const version = await packageVersion();
  const invocation = resolveCliInvocation(process.argv.slice(2), {
    env: process.env,
    stdinIsTTY: process.stdin.isTTY,
    stdoutIsTTY: process.stdout.isTTY,
  });
  if (invocation.command === 'help') {
    console.log(cliHelp(version));
    return;
  }
  if (invocation.command === 'version') {
    console.log(version);
    return;
  }
  if (invocation.command === 'setup') {
    if (!shouldUseSetupWizard({
      env: process.env,
      stdinIsTTY: process.stdin.isTTY,
      stdoutIsTTY: process.stdout.isTTY,
    })) {
      console.log(`Interactive setup requires a TTY.\n\n${cliHelp(version)}`);
      return;
    }
    const result = await runSetupWizard({ version });
    if (result === 'serve') return serve([]);
    return;
  }
  if (invocation.command === 'serve') return serve(invocation.args);
  if (invocation.command === 'doctor') return doctor(invocation.args.includes('--live'));
  if (invocation.command === 'auth') {
    const args = invocation.args;
    const credentials = args.includes('--manual') ? await manualAuth() : await browserAuth();
    const info = await preflightWithRetry(new InternalNotionTransport(), credentials);
    console.log(`OK: ${info.userName || info.userEmail} — ${info.workspaceName}`);
    return;
  }
  throw new Error(`Unknown command: ${invocation.args[0] ?? ''}. Run: nodex --help`);
}

async function packageVersion(): Promise<string> {
  const source = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
    version?: unknown;
  };
  return typeof source.version === 'string' ? source.version : '0.0.0';
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
