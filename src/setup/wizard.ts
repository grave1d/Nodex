import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import type { Credentials } from '../auth/credentials.js';
import {
  browserAuth,
  manualAuth,
  type BrowserAuthOptions,
  type BrowserAuthStatus,
} from '../auth/browser.js';
import {
  defaultConsoleSettingsPath,
  loadConsoleLanguage,
  saveConsoleLanguage,
} from '../console/dashboard.js';
import { loadConfig, type NodexConfig } from '../config.js';
import { SUPPORTED_LANGUAGES } from '../i18n/languages.js';
import { assertCompleteTurn, parseProtocol } from '../protocol/parser.js';
import { generateProtocolPreamble } from '../protocol/preamble.js';
import {
  InternalNotionTransport,
  notionModelOptions,
  sameNotionId,
} from '../transport/notion.js';
import type {
  AgentBinding,
  DiscoveredNotionAgent,
  PreflightInfo,
  TransportRequest,
  TransportTurn,
} from '../transport/types.js';
import { diagnoseAgentBindings, diagnosticLines } from './diagnostics.js';
import {
  appendGitignoreEntries,
  DEFAULT_MODEL_ID,
  ensureLocalApiKey,
  missingGitignoreEntries,
  planConfigUpdate,
  writeConfigPlan,
} from './files.js';
import { NODEX_LOGO, SETUP_COPY, type SetupAction, type SetupCopy } from './i18n.js';
import {
  ProcessSetupTerminal,
  SetupCancelledError,
  type SetupChoice,
  type SetupTerminal,
} from './terminal.js';

const DOCUMENTATION_URL = 'https://github.com/grave1d/Nodex#readme';
const AGENTS_URL = 'https://app.notion.com/agents';
const MANUAL_ID_URL = 'https://github.com/grave1d/Nodex/blob/main/docs/advanced/notion-agent-id.md';

interface SetupTransport {
  preflight(credentials?: Credentials): Promise<PreflightInfo>;
  discoverCustomAgents(): Promise<DiscoveredNotionAgent[]>;
  send(request: TransportRequest): Promise<TransportTurn>;
}

export interface SetupWizardOptions {
  version: string;
  cwd?: string;
  settingsPath?: string;
  terminal?: SetupTerminal;
  transport?: SetupTransport;
  authenticate?: (options: BrowserAuthOptions) => Promise<Credentials>;
  manualAuthenticate?: () => Promise<Credentials>;
  openUrl?: (url: string) => Promise<void>;
  liveTest?: (transport: SetupTransport, binding: AgentBinding, timeoutMs: number) => Promise<void>;
}

export type SetupWizardResult = 'exit' | 'serve';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function openExternalUrl(url: string): Promise<void> {
  const command = process.platform === 'win32' ? 'rundll32'
    : process.platform === 'darwin' ? 'open'
      : 'xdg-open';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

function welcomeHeader(
  copy: SetupCopy,
  version: string,
  account?: PreflightInfo,
  selected?: DiscoveredNotionAgent,
): string[] {
  return [
    ...NODEX_LOGO,
    copy.tagline,
    `${copy.version} ${version} · ${copy.license}`,
    ...(account ? ['', `${copy.account}: ${account.userEmail || account.userName}`, `${copy.workspace}: ${account.workspaceName}`] : []),
    ...(selected ? [`${copy.current}: ${selected.name}`] : []),
  ];
}

function browserStatusLine(status: BrowserAuthStatus, copy: SetupCopy): string {
  if (status === 'opening') return copy.openingNotion;
  if (status === 'checking-session') return copy.checkingSession;
  if (status === 'waiting-for-sign-in') return copy.waitingForSignIn;
  return copy.connected;
}

function modelDescription(agent: DiscoveredNotionAgent, copy: SetupCopy, current: boolean): string {
  const details = [agent.spaceName, agent.modelName ?? agent.modelSlug]
    .filter((value): value is string => Boolean(value));
  if (current) details.push(copy.current);
  return details.join(' · ');
}

async function configuredAgentIds(configPath: string): Promise<string[]> {
  const config = await loadConfig(configPath);
  return Object.values(config.models).flatMap((binding) => {
    return [binding.agentInstructionsPageId];
  });
}

async function firstBinding(
  configPath: string,
): Promise<{ config: NodexConfig; binding: AgentBinding | undefined }> {
  const config = await loadConfig(configPath);
  return { config, binding: config.models[DEFAULT_MODEL_ID] ?? Object.values(config.models)[0] };
}

async function collect(chunks: AsyncIterable<string>): Promise<string> {
  let result = '';
  for await (const chunk of chunks) result += chunk;
  return result;
}

export async function liveConnectionTest(
  transport: SetupTransport,
  binding: AgentBinding,
  timeoutMs: number,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const turn = await transport.send({
      threadId: randomUUID(),
      newThread: true,
      state: '{}',
      agent: binding,
      signal: controller.signal,
      attachments: [],
      message: `${generateProtocolPreamble()}\n\nTOOLS hash=setup []\nTOOL_CHOICE "none"\nINPUT\nNodex connection test. Reply with OK.`,
    });
    const raw = await collect(turn.chunks);
    const events = parseProtocol(raw).events;
    assertCompleteTurn(events);
    const terminal = events.at(-1);
    if (terminal?.type !== 'final' || !/\bOK\b/i.test(terminal.text)) {
      throw new Error('Live agent did not return the expected OK marker');
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function doctorReport(
  configPath: string,
  transport: Pick<SetupTransport, 'preflight' | 'discoverCustomAgents'>,
): Promise<{ account: PreflightInfo; lines: string[]; hasErrors: boolean }> {
  const config = await loadConfig(configPath);
  const account = await transport.preflight();
  const agents = await transport.discoverCustomAgents();
  const diagnostics = diagnoseAgentBindings(config, agents);
  return {
    account,
    lines: diagnosticLines(diagnostics),
    hasErrors: diagnostics.some((diagnostic) => diagnostic.kind !== 'ok') || diagnostics.length === 0,
  };
}

export async function runSetupWizard(options: SetupWizardOptions): Promise<SetupWizardResult> {
  const cwd = options.cwd ?? process.cwd();
  const configPath = join(cwd, 'nodex.config.json');
  const envPath = join(cwd, '.env');
  const gitignorePath = join(cwd, '.gitignore');
  const settingsPath = options.settingsPath ?? defaultConsoleSettingsPath();
  const terminal = options.terminal ?? new ProcessSetupTerminal();
  const transport = options.transport ?? new InternalNotionTransport();
  const authenticate = options.authenticate ?? browserAuth;
  const manualAuthenticate = options.manualAuthenticate ?? manualAuth;
  const openUrl = options.openUrl ?? openExternalUrl;
  const runLiveTest = options.liveTest ?? liveConnectionTest;
  let language = await loadConsoleLanguage(settingsPath);
  let account: PreflightInfo | undefined;
  let selectedAgent: DiscoveredNotionAgent | undefined;

  const pauseError = async (error: unknown): Promise<void> => {
    const copy = SETUP_COPY[language];
    terminal.screen([copy.errorTitle, '', errorMessage(error)]);
    await terminal.pause(copy.errorTitle, copy.continue);
  };

  const ensureAccount = async (): Promise<boolean> => {
    if (account) return true;
    const copy = SETUP_COPY[language];
    try {
      account = await terminal.wait(copy.checkingSession, async () => transport.preflight());
      return true;
    } catch {
      terminal.screen([copy.connectFirst]);
      await terminal.pause(copy.connectFirst, copy.continue);
      return false;
    }
  };

  const connect = async (): Promise<void> => {
    for (;;) {
      const copy = SETUP_COPY[language];
      try {
        account = await terminal.wait(copy.openingNotion, async (update) => {
          const credentials = await authenticate({
            forceSignIn: true,
            onStatus: (status) => { update(browserStatusLine(status, copy)); },
          });
          update(copy.checkingSession);
          return transport.preflight(credentials);
        });
      } catch (error) {
        const action = await terminal.choose(copy.authFailed, [
          { value: 'retry', label: copy.retry },
          { value: 'manual', label: copy.manualAuth },
          { value: 'troubleshooting', label: copy.troubleshooting },
          { value: 'back', label: copy.back },
        ] as const, { header: [errorMessage(error)] });
        if (action === 'retry') continue;
        if (action === 'troubleshooting') {
          await terminal.wait(copy.troubleshooting, async () => {
            return openUrl(`${DOCUMENTATION_URL.replace('#readme', '')}/blob/main/docs/advanced/troubleshooting.md`);
          });
          continue;
        }
        if (action !== 'manual') return;
        try {
          const credentials = await manualAuthenticate();
          account = await terminal.wait(copy.checkingSession, async () => {
            return transport.preflight(credentials);
          });
        } catch (manualError) {
          await pauseError(manualError);
          continue;
        }
      }
      terminal.screen([
        copy.connected,
        '',
        `${copy.account}: ${account.userEmail || account.userName}`,
        `${copy.workspace}: ${account.workspaceName}`,
        copy.credentialsSaved,
      ]);
      await terminal.pause(copy.connected, copy.continue);
      return;
    }
  };

  const selectAgent = async (): Promise<void> => {
    if (!await ensureAccount()) return;
    const copy = SETUP_COPY[language];
    for (;;) {
      const agents = await terminal.wait(copy.findingAgents, async () => {
        return transport.discoverCustomAgents();
      });
      if (!agents.length) {
        const action = await terminal.choose(copy.noAgents, [
          { value: 'retry', label: copy.retry },
          { value: 'create', label: copy.createAgent },
          { value: 'manual', label: copy.manualFallback },
          { value: 'back', label: copy.back },
        ] as const, { header: [copy.noAgentAccess] });
        if (action === 'retry') continue;
        if (action === 'create') {
          await terminal.wait(copy.createAgent, async () => openUrl(AGENTS_URL));
          continue;
        }
        if (action === 'manual') {
          await terminal.wait(copy.manualFallback, async () => openUrl(MANUAL_ID_URL));
          continue;
        }
        return;
      }

      const currentIds = await configuredAgentIds(configPath);
      const choices: SetupChoice[] = agents.map((agent, index) => {
        const current = currentIds.some((id) => sameNotionId(id, agent.agentInstructionsPageId));
        return {
          value: String(index),
          label: `${agent.name}${current ? ` · ${copy.current}` : ''}`,
          description: modelDescription(agent, copy, current),
        };
      });
      const choice = await terminal.choose(copy.agentsTitle, choices, { allowBack: true });
      if (choice === undefined) return;
      const agent = agents[Number(choice)];
      if (!agent) continue;

      const models = notionModelOptions(agents).sort((left, right) => {
        if (left.slug === agent.modelSlug) return -1;
        if (right.slug === agent.modelSlug) return 1;
        return left.name.localeCompare(right.name);
      });
      const modelChoice = await terminal.choose(copy.modelsTitle, models.map((model, index) => ({
        value: String(index),
        label: model.name,
        ...(model.slug === agent.modelSlug ? { description: copy.current } : {}),
      })), { allowBack: true, header: [agent.name] });
      if (modelChoice === undefined) return;
      const model = models[Number(modelChoice)];
      if (!model) continue;
      const configuredAgent: DiscoveredNotionAgent = {
        ...agent,
        modelSlug: model.slug,
        modelName: model.name,
      };
      const plan = await terminal.wait(copy.menu['select-agent'], async () => {
        return planConfigUpdate(configuredAgent, configPath);
      });
      if (!plan.changed) {
        selectedAgent = configuredAgent;
        terminal.screen([copy.configUnchanged]);
        await terminal.pause(copy.configUnchanged, copy.continue);
        return;
      }
      const summary = [
        plan.exists ? copy.configUpdate : copy.configCreate,
        ...plan.summary.map((line) => `• ${line}`),
      ];
      if (plan.exists && !await terminal.confirm(copy.configConfirm, copy, true, summary)) return;
      if (!plan.exists) terminal.screen(summary);
      const saved = await terminal.wait(copy.menu['select-agent'], async () => writeConfigPlan(plan));
      selectedAgent = configuredAgent;
      terminal.screen([
        copy.configSaved,
        ...(saved.backupPath ? [`${copy.backupSaved}: ${saved.backupPath}`] : []),
      ]);
      await terminal.pause(copy.configSaved, copy.continue);
      return;
    }
  };

  const getApiKey = async (): Promise<void> => {
    const copy = SETUP_COPY[language];
    const missing = await terminal.wait(copy.menu['api-key'], async () => {
      await ensureLocalApiKey(envPath);
      return missingGitignoreEntries(gitignorePath);
    });
    if (missing.length && await terminal.confirm(
      copy.gitignoreConfirm,
      copy,
      true,
      missing.map((entry) => `• ${entry}`),
    )) {
      await appendGitignoreEntries(missing, gitignorePath);
    }
  };

  const verify = async (): Promise<void> => {
    if (!await ensureAccount()) return;
    const copy = SETUP_COPY[language];
    const { config, binding } = await firstBinding(configPath);
    if (!binding) {
      terminal.screen([copy.connectFirst]);
      await terminal.pause(copy.connectFirst, copy.continue);
      return;
    }
    const agents = await terminal.wait(copy.findingAgents, async () => {
      return transport.discoverCustomAgents();
    });
    const diagnostics = diagnoseAgentBindings(config, agents);
    const selectedDiagnostic = diagnostics.find((item) => item.modelId === DEFAULT_MODEL_ID)
      ?? diagnostics[0];
    if (!selectedDiagnostic || selectedDiagnostic.kind !== 'ok') {
      terminal.screen([copy.verifyMissing, ...diagnosticLines(diagnostics)]);
      await terminal.pause(copy.verifyMissing, copy.continue);
      return;
    }
    const desiredModel = binding.syncNotionModel === false ? undefined : binding.notionModelSlug;
    const currentModel = selectedDiagnostic.agent.modelSlug;
    const modelCheck = desiredModel && currentModel && desiredModel !== currentModel
      ? `${copy.modelSyncPending} ${currentModel} → ${desiredModel}`
      : desiredModel && currentModel
        ? copy.modelSyncMatches
        : copy.modelSyncNotRequired;
    terminal.screen([copy.verifySafeOk, modelCheck]);
    if (!await terminal.confirm(`${copy.liveTestWarning}\n${copy.liveTestQuestion}`, copy, false)) return;
    await terminal.wait(copy.liveTestQuestion, async () => {
      return runLiveTest(transport, binding, config.turnTimeoutMs);
    });
    terminal.screen([copy.liveTestOk]);
    await terminal.pause(copy.liveTestOk, copy.continue);
  };

  try {
    try {
      account = await terminal.wait(SETUP_COPY[language].checkingSession, async () => {
        return transport.preflight();
      });
    } catch {
      account = undefined;
    }

    for (;;) {
      const copy = SETUP_COPY[language];
      const actions: SetupAction[] = account
        ? [
          'connect',
          'select-agent',
          'api-key',
          'verify',
          'prepare-agent',
          'start-server',
          'doctor',
          'language',
          'documentation',
          'exit',
        ]
        : ['connect', 'language', 'documentation', 'exit'];
      const action = await terminal.choose(copy.mainMenu, actions.map((value) => ({
        value,
        label: value === 'connect' && account ? copy.changeAccount : copy.menu[value],
      })), {
        header: welcomeHeader(copy, options.version, account, selectedAgent),
        allowBack: true,
      });

      if (action === undefined) {
        terminal.screen([copy.goodbye]);
        return 'exit';
      }

      try {
        if (action === 'connect') await connect();
        if (action === 'select-agent') await selectAgent();
        if (action === 'api-key') await getApiKey();
        if (action === 'verify') await verify();
        if (action === 'prepare-agent') {
          await terminal.wait(copy.menu['prepare-agent'], () => Promise.resolve());
          terminal.screen([copy.prepareTitle, '', copy.prepareNotRequired]);
          await terminal.pause(copy.prepareTitle, copy.continue);
        }
        if (action === 'start-server') {
          const { binding } = await firstBinding(configPath);
          if (!binding) {
            terminal.screen([copy.connectFirst]);
            await terminal.pause(copy.connectFirst, copy.continue);
            continue;
          }
          await terminal.wait(copy.menu['start-server'], async () => {
            await ensureLocalApiKey(envPath);
          });
          return 'serve';
        }
        if (action === 'doctor') {
          const report = await terminal.wait(copy.menu.doctor, async () => {
            return doctorReport(configPath, transport);
          });
          terminal.screen([
            copy.doctorTitle,
            `${copy.account}: ${report.account.userEmail || report.account.userName}`,
            `${copy.workspace}: ${report.account.workspaceName}`,
            '',
            ...report.lines,
          ]);
          await terminal.pause(copy.doctorTitle, copy.continue);
        }
        if (action === 'language') {
          const next = await terminal.choose(copy.menu.language, SUPPORTED_LANGUAGES.map((item) => ({
            value: item.code,
            label: item.name,
          })), {
            initial: Math.max(0, SUPPORTED_LANGUAGES.findIndex(({ code }) => code === language)),
          });
          if (next) {
            await terminal.wait(copy.menu.language, async () => {
              await saveConsoleLanguage(next, settingsPath);
            });
            language = next;
          }
        }
        if (action === 'documentation') {
          await terminal.wait(copy.menu.documentation, async () => openUrl(DOCUMENTATION_URL));
          terminal.screen([copy.docsOpened]);
          await terminal.pause(copy.docsOpened, copy.continue);
        }
        if (action === 'exit') {
          await terminal.wait(copy.menu.exit, () => Promise.resolve());
          terminal.screen([copy.goodbye]);
          return 'exit';
        }
      } catch (error) {
        if (error instanceof SetupCancelledError) throw error;
        await pauseError(error);
      }
    }
  } catch (error) {
    if (!(error instanceof SetupCancelledError)) throw error;
    terminal.screen([SETUP_COPY[language].cancelled]);
    return 'exit';
  } finally {
    terminal.close();
  }
}
