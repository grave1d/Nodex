import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { runSetupWizard } from '../src/setup/wizard.js';
import type { SetupChoice, SetupTerminal } from '../src/setup/terminal.js';
import type {
  DiscoveredNotionAgent,
  PreflightInfo,
  TransportRequest,
  TransportTurn,
} from '../src/transport/types.js';

let directory = '';
afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = '';
});

class FakeTerminal implements SetupTerminal {
  readonly screens: string[][] = [];
  constructor(private readonly answers: Array<string | undefined>) {}
  screen(lines: readonly string[]): void { this.screens.push([...lines]); }
  choose<T extends string>(
    _title: string,
    _choices: readonly SetupChoice<T>[],
  ): Promise<T | undefined> {
    return Promise.resolve(this.answers.shift() as T | undefined);
  }
  confirm(): Promise<boolean> { return Promise.resolve(true); }
  pause(): Promise<void> { return Promise.resolve(); }
}

const account: PreflightInfo = {
  userId: 'user',
  userName: 'Test User',
  userEmail: 'test@example.invalid',
  workspaceId: 'space',
  workspaceName: 'Workspace',
  spaceViewId: 'view',
};

function discovered(name: string, workflowId: string, pageId: string): DiscoveredNotionAgent {
  return {
    name,
    workflowId,
    agentInstructionsPageId: pageId,
    spaceId: 'space',
    spaceName: 'Workspace',
    modelSlug: 'orange-mousse',
  };
}

function transport(agents: DiscoveredNotionAgent[]) {
  return {
    preflight: async () => account,
    discoverCustomAgents: async () => agents,
    send: async (_request: TransportRequest): Promise<TransportTurn> => ({
      chunks: (async function* () { yield '{"type":"final","text":"OK"}'; })(),
      nextState: '{}',
    }),
  };
}

it('selects among multiple agents and stores the internal instructions page ID', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-wizard-'));
  const terminal = new FakeTerminal(['select-agent', '1', 'exit']);
  const result = await runSetupWizard({
    version: '0.2.0',
    cwd: directory,
    settingsPath: join(directory, 'ui.json'),
    terminal,
    transport: transport([
      discovered('First', 'workflow-one', 'instructions-one'),
      discovered('Second', 'workflow-two', 'instructions-two'),
    ]),
    openUrl: async () => undefined,
  });
  expect(result).toBe('exit');
  const config = JSON.parse(await readFile(join(directory, 'nodex.config.json'), 'utf8')) as {
    models: Record<string, { agentInstructionsPageId: string }>;
  };
  expect(config.models['codex-notion-agent']?.agentInstructionsPageId).toBe('instructions-two');
});

it('handles an empty agent list without crashing or writing config', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-wizard-empty-'));
  const terminal = new FakeTerminal(['select-agent', 'back', 'exit']);
  await expect(runSetupWizard({
    version: '0.2.0',
    cwd: directory,
    settingsPath: join(directory, 'ui.json'),
    terminal,
    transport: transport([]),
    openUrl: async () => undefined,
  })).resolves.toBe('exit');
  await expect(readFile(join(directory, 'nodex.config.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
});

it('offers hidden manual authentication after browser sign-in fails', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-wizard-auth-'));
  const terminal = new FakeTerminal(['connect', 'manual', 'exit']);
  let manualCalls = 0;
  await runSetupWizard({
    version: '0.2.0',
    cwd: directory,
    settingsPath: join(directory, 'ui.json'),
    terminal,
    transport: transport([]),
    authenticate: async () => { throw new Error('Browser unavailable'); },
    manualAuthenticate: async () => {
      manualCalls += 1;
      return { token_v2: 'synthetic-token', notion_browser_id: 'synthetic-browser' };
    },
    openUrl: async () => undefined,
  });
  expect(manualCalls).toBe(1);
  expect(terminal.screens.flat().join('\n')).toContain('test@example.invalid');
});

it('performs a dry model-sync comparison before an explicitly confirmed live test', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-wizard-verify-'));
  await writeFile(join(directory, 'nodex.config.json'), JSON.stringify({
    models: {
      'codex-notion-agent': {
        agentInstructionsPageId: 'instructions-one',
        agentName: 'First',
        notionModel: 'Desired',
        notionModelSlug: 'desired-model',
      },
    },
  }), 'utf8');
  const terminal = new FakeTerminal(['verify', 'exit']);
  let liveTests = 0;
  const current = discovered('First', 'workflow-one', 'instructions-one');
  current.modelSlug = 'current-model';
  await runSetupWizard({
    version: '0.2.0',
    cwd: directory,
    settingsPath: join(directory, 'ui.json'),
    terminal,
    transport: transport([current]),
    liveTest: async () => { liveTests += 1; },
    openUrl: async () => undefined,
  });
  expect(liveTests).toBe(1);
  expect(terminal.screens.flat().join('\n')).toContain('current-model → desired-model');
});
