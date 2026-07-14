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
  readonly menus: Array<{ title: string; labels: string[]; header: string[] }> = [];
  pauseCalls = 0;
  closed = false;
  constructor(private readonly answers: Array<string | undefined>) {}
  screen(lines: readonly string[]): void { this.screens.push([...lines]); }
  choose<T extends string>(
    title: string,
    choices: readonly SetupChoice<T>[],
    options: { header?: readonly string[] } = {},
  ): Promise<T | undefined> {
    this.menus.push({
      title,
      labels: choices.map(({ label }) => label),
      header: [...(options.header ?? [])],
    });
    return Promise.resolve(this.answers.shift() as T | undefined);
  }
  confirm(): Promise<boolean> { return Promise.resolve(true); }
  pause(): Promise<void> { this.pauseCalls += 1; return Promise.resolve(); }
  wait<T>(
    _message: string,
    operation: (update: (message: string) => void) => Promise<T>,
  ): Promise<T> {
    return operation(() => undefined);
  }
  close(): void { this.closed = true; }
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
  const terminal = new FakeTerminal(['select-agent', '1', '0', 'exit']);
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
  expect(terminal.closed).toBe(true);
});

it('shows only the four safe actions before Notion is connected', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-wizard-disconnected-'));
  const terminal = new FakeTerminal(['exit']);
  const unavailable = transport([]);
  unavailable.preflight = async () => { throw new Error('No saved session'); };

  await runSetupWizard({
    version: '0.2.0',
    cwd: directory,
    settingsPath: join(directory, 'ui.json'),
    terminal,
    transport: unavailable,
    openUrl: async () => undefined,
  });

  expect(terminal.menus[0]?.labels).toEqual([
    'Connect Notion',
    'Change language',
    'Open documentation',
    'Exit',
  ]);
  expect(terminal.menus[0]?.header.join('\n')).not.toContain('unofficial private Notion API');
});

it('offers every README language and restores the saved choice', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-wizard-language-'));
  const settingsPath = join(directory, 'ui.json');
  const unavailable = transport([]);
  unavailable.preflight = async () => { throw new Error('No saved session'); };
  const firstTerminal = new FakeTerminal(['language', 'ja', 'exit']);

  await runSetupWizard({
    version: '0.2.0',
    cwd: directory,
    settingsPath,
    terminal: firstTerminal,
    transport: unavailable,
    openUrl: async () => undefined,
  });

  expect(firstTerminal.menus[1]?.labels).toEqual([
    'English', '中文', 'हिन्दी', 'Español', 'Français', 'العربية', 'বাংলা', 'Português',
    'Русский', 'اردو', 'Deutsch', '日本語', 'Italiano', 'Українська', 'Polski', 'Српски',
  ]);
  expect(JSON.parse(await readFile(settingsPath, 'utf8'))).toEqual({ language: 'ja' });

  const secondTerminal = new FakeTerminal(['exit']);
  await runSetupWizard({
    version: '0.2.0',
    cwd: directory,
    settingsPath,
    terminal: secondTerminal,
    transport: unavailable,
    openUrl: async () => undefined,
  });
  expect(secondTerminal.menus[0]?.title).toBe('Nodex のセットアップ');
});

it('offers the connected account label and stores a selected agent model', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-wizard-model-'));
  const terminal = new FakeTerminal(['select-agent', '0', '1', 'exit']);
  const first = discovered('First', 'workflow-one', 'instructions-one');
  first.modelName = 'Sol';
  const second = discovered('Second', 'workflow-two', 'instructions-two');
  second.modelSlug = 'terra-model';
  second.modelName = 'Terra';

  await runSetupWizard({
    version: '0.2.0',
    cwd: directory,
    settingsPath: join(directory, 'ui.json'),
    terminal,
    transport: transport([first, second]),
    openUrl: async () => undefined,
  });

  expect(terminal.menus[0]?.labels[0]).toBe('Change Notion account');
  expect(terminal.menus.some(({ title }) => title === 'Choose a model for this agent')).toBe(true);
  const config = JSON.parse(await readFile(join(directory, 'nodex.config.json'), 'utf8')) as {
    models: Record<string, { notionModel: string; notionModelSlug: string }>;
  };
  expect(config.models['codex-notion-agent']).toMatchObject({
    notionModel: 'Terra',
    notionModelSlug: 'terra-model',
  });
});

it('returns directly to the menu after API-key gitignore handling', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-wizard-key-'));
  const terminal = new FakeTerminal(['api-key', 'exit']);

  await runSetupWizard({
    version: '0.2.0',
    cwd: directory,
    settingsPath: join(directory, 'ui.json'),
    terminal,
    transport: transport([]),
    openUrl: async () => undefined,
  });

  expect(terminal.pauseCalls).toBe(0);
  expect(terminal.menus.filter(({ title }) => title === 'Set up Nodex')).toHaveLength(2);
  expect(await readFile(join(directory, '.env'), 'utf8')).toContain('NODEX_API_KEY=');
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
  let forcedSignIn = false;
  await runSetupWizard({
    version: '0.2.0',
    cwd: directory,
    settingsPath: join(directory, 'ui.json'),
    terminal,
    transport: transport([]),
    authenticate: async (options) => {
      forcedSignIn = options.forceSignIn === true;
      throw new Error('Browser unavailable');
    },
    manualAuthenticate: async () => {
      manualCalls += 1;
      return { token_v2: 'synthetic-token', notion_browser_id: 'synthetic-browser' };
    },
    openUrl: async () => undefined,
  });
  expect(manualCalls).toBe(1);
  expect(forcedSignIn).toBe(true);
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
