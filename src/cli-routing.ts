export type CliCommand = 'setup' | 'serve' | 'auth' | 'doctor' | 'help' | 'version' | 'unknown';

export interface CliInvocation {
  command: CliCommand;
  args: string[];
  explicit: boolean;
}

function ciEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  const value = env['CI'];
  return Boolean(value && value !== '0' && value.toLowerCase() !== 'false');
}

export function shouldUseSetupWizard(options: {
  env: Readonly<Record<string, string | undefined>>;
  stdinIsTTY: boolean;
  stdoutIsTTY: boolean;
}): boolean {
  return options.stdinIsTTY
    && options.stdoutIsTTY
    && !ciEnabled(options.env)
    && options.env['NODEX_NO_SETUP'] !== '1';
}

export function resolveCliInvocation(
  argv: readonly string[],
  terminal: {
    env: Readonly<Record<string, string | undefined>>;
    stdinIsTTY: boolean;
    stdoutIsTTY: boolean;
  },
): CliInvocation {
  if (!argv.length) {
    return shouldUseSetupWizard(terminal)
      ? { command: 'setup', args: [], explicit: false }
      : { command: 'help', args: [], explicit: false };
  }
  const [first = '', ...args] = argv;
  if (first === '--help' || first === '-h' || first === 'help') return { command: 'help', args, explicit: true };
  if (first === '--version' || first === '-v') return { command: 'version', args, explicit: true };
  if (first === 'setup' && args.some((arg) => arg === '--help' || arg === '-h')) {
    return { command: 'help', args: [], explicit: true };
  }
  if (first === 'setup' || first === 'serve' || first === 'auth' || first === 'doctor') {
    return { command: first, args, explicit: true };
  }
  return { command: 'unknown', args: [first, ...args], explicit: true };
}

export function cliHelp(version: string): string {
  return `Nodex ${version} — connect Notion Custom Agents to Codex

Usage:
  nodex                 Open setup in an interactive terminal
  nodex setup           Open the setup wizard
  nodex serve           Start the local OpenAI-compatible server
  nodex auth [--manual] Connect a Notion account
  nodex doctor [--live] Check configuration and Notion access
  nodex --help           Show this help
  nodex --version        Show the installed version`;
}
