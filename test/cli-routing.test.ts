import { expect, it } from 'vitest';
import {
  cliHelp,
  resolveCliInvocation,
  shouldUseSetupWizard,
} from '../src/cli-routing.js';
import { menuKeyAction, renderSetupMenu } from '../src/setup/terminal.js';

const tty = { env: {}, stdinIsTTY: true, stdoutIsTTY: true };

it('routes no-argument TTY launches to setup and non-interactive launches to help', () => {
  expect(resolveCliInvocation([], tty)).toMatchObject({ command: 'setup', explicit: false });
  expect(resolveCliInvocation([], { ...tty, stdoutIsTTY: false })).toMatchObject({ command: 'help' });
  expect(resolveCliInvocation([], { ...tty, env: { CI: '1' } })).toMatchObject({ command: 'help' });
  expect(shouldUseSetupWizard({ ...tty, env: { NODEX_NO_SETUP: '1' } })).toBe(false);
});

it('keeps explicit commands and conventional help behavior', () => {
  expect(resolveCliInvocation(['serve', '--no-interactive'], tty)).toEqual({
    command: 'serve', args: ['--no-interactive'], explicit: true,
  });
  expect(resolveCliInvocation(['setup', '--help'], tty).command).toBe('help');
  expect(resolveCliInvocation(['--version'], tty).command).toBe('version');
  expect(cliHelp('0.2.0')).toContain('nodex setup');
  expect(cliHelp('0.2.0')).not.toContain('\u001b[');
});

it('maps setup navigation keys and renders safely without ANSI', () => {
  expect(menuKeyAction({ name: 'up' })).toBe('up');
  expect(menuKeyAction({ sequence: '\u001b[B' })).toBe('down');
  expect(menuKeyAction({ name: 'return' })).toBe('select');
  expect(menuKeyAction({ name: 'escape' })).toBe('back');
  expect(menuKeyAction({ name: 'c', ctrl: true })).toBe('cancel');
  const rendered = renderSetupMenu('Setup', [
    { value: 'safe', label: 'Safe\u001b[31m label' },
  ], 0, [], false);
  expect(rendered).toContain('Safe [31m label');
  expect(rendered).not.toContain('\u001b');
});
