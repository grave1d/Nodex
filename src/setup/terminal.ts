import { emitKeypressEvents } from 'node:readline';
import type { ReadStream, WriteStream } from 'node:tty';

export interface SetupChoice<T extends string = string> {
  value: T;
  label: string;
  description?: string;
}

export interface SetupTerminal {
  screen(lines: readonly string[]): void;
  choose<T extends string>(
    title: string,
    choices: readonly SetupChoice<T>[],
    options?: { header?: readonly string[]; initial?: number; allowBack?: boolean },
  ): Promise<T | undefined>;
  confirm(
    question: string,
    labels: { yes: string; no: string },
    defaultYes?: boolean,
    header?: readonly string[],
  ): Promise<boolean>;
  pause(message: string, continueLabel: string): Promise<void>;
}

export type MenuKeyAction = 'up' | 'down' | 'select' | 'back' | 'cancel' | 'none';

export class SetupCancelledError extends Error {
  constructor() { super('Setup cancelled'); }
}

function clean(value: string): string {
  return Array.from(value, (character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 31 || (code >= 127 && code <= 159) ? ' ' : character;
  }).join('').slice(0, 500);
}

function style(enabled: boolean, code: number, value: string): string {
  return enabled ? `\u001b[${code}m${value}\u001b[0m` : value;
}

export function menuKeyAction(key: { name?: string; sequence?: string; ctrl?: boolean }): MenuKeyAction {
  const name = key.name?.toLowerCase();
  if (key.ctrl && name === 'c') return 'cancel';
  if (name === 'up' || key.sequence === '\u001b[A') return 'up';
  if (name === 'down' || key.sequence === '\u001b[B') return 'down';
  if (name === 'return' || name === 'enter' || key.sequence === '\r') return 'select';
  if (name === 'escape' || name === 'backspace' || key.sequence === '\u001b') return 'back';
  return 'none';
}

export function renderSetupMenu<T extends string>(
  title: string,
  choices: readonly SetupChoice<T>[],
  selected: number,
  header: readonly string[] = [],
  ansi = true,
): string {
  const lines = [...header.map(clean), header.length ? '' : undefined, style(ansi, 1, clean(title)), '']
    .filter((line): line is string => line !== undefined);
  choices.forEach((choice, index) => {
    const active = index === selected;
    const label = `${active ? '›' : ' '} ${clean(choice.label)}`;
    lines.push(active ? style(ansi, 36, label) : label);
    if (active && choice.description) lines.push(style(ansi, 2, `    ${clean(choice.description)}`));
  });
  return `${lines.join('\n')}\n`;
}

export class ProcessSetupTerminal implements SetupTerminal {
  private readonly ansi: boolean;

  constructor(
    private readonly input: ReadStream = process.stdin,
    private readonly output: WriteStream = process.stdout,
    ansi = !('NO_COLOR' in process.env),
  ) {
    this.ansi = ansi;
    emitKeypressEvents(this.input);
  }

  screen(lines: readonly string[]): void {
    this.output.write(`\u001b[2J\u001b[H${lines.map(clean).join('\n')}\n`);
  }

  async choose<T extends string>(
    title: string,
    choices: readonly SetupChoice<T>[],
    options: { header?: readonly string[]; initial?: number; allowBack?: boolean } = {},
  ): Promise<T | undefined> {
    if (!choices.length) return undefined;
    let selected = Math.max(0, Math.min(options.initial ?? 0, choices.length - 1));
    const wasRaw = this.input.isRaw;
    this.input.setRawMode(true);
    this.input.resume();

    const paint = (): void => {
      this.output.write(`\u001b[2J\u001b[H${renderSetupMenu(title, choices, selected, options.header, this.ansi)}`);
    };

    try {
      paint();
      return await new Promise<T | undefined>((resolve, reject) => {
        const onKeypress = (
          _sequence: string,
          key: { name?: string; sequence?: string; ctrl?: boolean },
        ): void => {
          const action = menuKeyAction(key);
          if (action === 'cancel') {
            this.input.removeListener('keypress', onKeypress);
            reject(new SetupCancelledError());
            return;
          }
          if (action === 'back' && options.allowBack !== false) {
            this.input.removeListener('keypress', onKeypress);
            resolve(undefined);
            return;
          }
          if (action === 'select') {
            this.input.removeListener('keypress', onKeypress);
            resolve(choices[selected]?.value);
            return;
          }
          if (action === 'up') selected = (selected - 1 + choices.length) % choices.length;
          if (action === 'down') selected = (selected + 1) % choices.length;
          if (action === 'up' || action === 'down') paint();
        };
        this.input.on('keypress', onKeypress);
      });
    } finally {
      this.input.setRawMode(wasRaw);
      this.input.pause();
    }
  }

  async confirm(
    question: string,
    labels: { yes: string; no: string },
    defaultYes = true,
    header: readonly string[] = [],
  ): Promise<boolean> {
    const choices: SetupChoice<'yes' | 'no'>[] = [
      { value: 'yes', label: labels.yes },
      { value: 'no', label: labels.no },
    ];
    const answer = await this.choose(question, choices, {
      initial: defaultYes ? 0 : 1,
      allowBack: true,
      header,
    });
    return answer === 'yes';
  }

  async pause(message: string, continueLabel: string): Promise<void> {
    await this.choose(message, [{ value: 'continue', label: continueLabel }], { allowBack: true });
  }
}
