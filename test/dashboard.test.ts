import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import {
  dashboardAction,
  loadConsoleLanguage,
  prepareConsoleLogFile,
  renderDashboard,
  saveConsoleLanguage,
  shouldUseInteractiveConsole,
  toggleConsoleLanguage,
  type DashboardState,
} from '../src/console/dashboard.js';

let directory = '';
afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = '';
});

function state(): DashboardState {
  return {
    language: 'ru',
    health: 'ready',
    notion: 'unchecked',
    address: 'http://127.0.0.1:8787',
    bindings: [{ id: 'gpt-5.6-sol', agentName: 'Nodex Agent', notionModel: 'GPT-5.6 Sol' }],
    logPath: 'C:\\Users\\Test\\.nodex\\nodex.log',
    showHelp: false,
  };
}

it('renders a compact localized dashboard without ANSI when disabled', () => {
  const russian = renderDashboard(state(), false);
  const english = renderDashboard({ ...state(), language: 'en', showHelp: true }, false);

  expect(russian).toContain('Состояние: готов');
  expect(russian).toContain('/v1/responses');
  expect(russian).toContain('gpt-5.6-sol → Nodex Agent · GPT-5.6 Sol');
  expect(russian).not.toContain('\u001b[');
  expect(english).toContain('Status: ready');
  expect(english).toContain('Keys · English');

  const unsafe = renderDashboard({
    ...state(),
    bindings: [{ id: 'bad\u001b[31m', agentName: 'Agent', notionModel: 'Model' }],
  }, false);
  expect(unsafe).not.toContain('\u001b');
});

it('enables keyboard input only for an interactive terminal', () => {
  const base = { args: [] as string[], env: {}, stdinIsTTY: true, stdoutIsTTY: true };
  expect(shouldUseInteractiveConsole(base)).toBe(true);
  expect(shouldUseInteractiveConsole({ ...base, stdoutIsTTY: false })).toBe(false);
  expect(shouldUseInteractiveConsole({ ...base, env: { CI: '1' } })).toBe(false);
  expect(shouldUseInteractiveConsole({ ...base, args: ['--no-interactive'] })).toBe(false);
  expect(shouldUseInteractiveConsole({ ...base, env: { NODEX_NO_DASHBOARD: '1' } })).toBe(false);
});

it('maps dashboard keys without treating ordinary input as commands', () => {
  expect(dashboardAction({ name: 'h' })).toBe('help');
  expect(dashboardAction({ sequence: '?' })).toBe('help');
  expect(dashboardAction({ name: 'r' })).toBe('refresh');
  expect(dashboardAction({ name: 'c', ctrl: true })).toBe('quit');
  expect(dashboardAction({ name: 'x' })).toBe('none');
});

it('persists only a validated console language choice', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-dashboard-'));
  const path = join(directory, 'nested', 'ui.json');
  await saveConsoleLanguage('ru', path);

  expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ language: 'ru' });
  expect(await loadConsoleLanguage(path, 'en')).toBe('ru');
  expect(toggleConsoleLanguage('ru')).toBe('en');

  await writeFile(path, '{"language":"unsupported","secret":"ignored"}', 'utf8');
  expect(await loadConsoleLanguage(path, 'en')).toBe('en');
});

it('prepares a private append-only destination for structured logs', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-dashboard-log-'));
  const path = join(directory, 'nested', 'nodex.log');
  await prepareConsoleLogFile(path);

  expect(await readFile(path, 'utf8')).toBe('');
});
