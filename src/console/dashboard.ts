import { chmod, mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export type ConsoleLanguage = 'ru' | 'en';
export type DashboardHealth = 'starting' | 'ready' | 'checking' | 'error' | 'stopping';
export type NotionHealth = 'unchecked' | 'ok' | 'error';
export type DashboardAction = 'help' | 'refresh' | 'clear' | 'language' | 'quit' | 'none';

export interface DashboardBinding {
  id: string;
  agentName: string;
  notionModel: string;
}

export interface DashboardState {
  language: ConsoleLanguage;
  health: DashboardHealth;
  notion: NotionHealth;
  address: string;
  bindings: DashboardBinding[];
  logPath: string;
  showHelp: boolean;
}

interface ConsoleCopy {
  title: string;
  status: string;
  server: string;
  responses: string;
  chat: string;
  modelsApi: string;
  healthApi: string;
  bindings: string;
  noBindings: string;
  notion: string;
  logs: string;
  helpHint: string;
  helpTitle: string;
  languageName: string;
  languageHint: string;
  health: Record<DashboardHealth, string>;
  notionHealth: Record<NotionHealth, string>;
}

const COPY: Record<ConsoleLanguage, ConsoleCopy> = {
  ru: {
    title: 'Nodex — локальный мост к Notion Custom Agents',
    status: 'Состояние',
    server: 'Сервер',
    responses: 'Responses',
    chat: 'Chat (legacy)',
    modelsApi: 'Models',
    healthApi: 'Health',
    bindings: 'Активные модели',
    noBindings: 'нет настроенных bindings',
    notion: 'Notion',
    logs: 'Структурированные логи',
    helpHint: 'H помощь  R проверить Notion  L English  C очистить  Q выход',
    helpTitle: 'Клавиши',
    languageName: 'Русский',
    languageHint: 'L переключает язык и сохраняет выбор в ~/.nodex/ui.json.',
    health: {
      starting: 'запуск',
      ready: 'готов',
      checking: 'проверка',
      error: 'ошибка',
      stopping: 'остановка',
    },
    notionHealth: {
      unchecked: 'не проверен',
      ok: 'доступен',
      error: 'недоступен',
    },
  },
  en: {
    title: 'Nodex — local bridge to Notion Custom Agents',
    status: 'Status',
    server: 'Server',
    responses: 'Responses',
    chat: 'Chat (legacy)',
    modelsApi: 'Models',
    healthApi: 'Health',
    bindings: 'Active models',
    noBindings: 'no bindings configured',
    notion: 'Notion',
    logs: 'Structured logs',
    helpHint: 'H help  R check Notion  L Русский  C clear  Q quit',
    helpTitle: 'Keys',
    languageName: 'English',
    languageHint: 'L switches the language and saves it to ~/.nodex/ui.json.',
    health: {
      starting: 'starting',
      ready: 'ready',
      checking: 'checking',
      error: 'error',
      stopping: 'stopping',
    },
    notionHealth: {
      unchecked: 'not checked',
      ok: 'available',
      error: 'unavailable',
    },
  },
};

export function defaultConsoleSettingsPath(): string {
  return join(homedir(), '.nodex', 'ui.json');
}

export function defaultConsoleLogPath(): string {
  return join(homedir(), '.nodex', 'nodex.log');
}

export function inferredConsoleLanguage(locale = Intl.DateTimeFormat().resolvedOptions().locale): ConsoleLanguage {
  return locale.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export async function loadConsoleLanguage(
  path = defaultConsoleSettingsPath(),
  fallback = inferredConsoleLanguage(),
): Promise<ConsoleLanguage> {
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as { language?: unknown };
    return value.language === 'ru' || value.language === 'en' ? value.language : fallback;
  } catch {
    return fallback;
  }
}

export async function saveConsoleLanguage(
  language: ConsoleLanguage,
  path = defaultConsoleSettingsPath(),
): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify({ language }, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await chmod(path, 0o600);
}

export async function prepareConsoleLogFile(path = defaultConsoleLogPath()): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const handle = await open(path, 'a', 0o600);
  await handle.close();
  await chmod(path, 0o600);
}

export function toggleConsoleLanguage(language: ConsoleLanguage): ConsoleLanguage {
  return language === 'ru' ? 'en' : 'ru';
}

export function shouldUseInteractiveConsole(options: {
  args: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
  stdinIsTTY: boolean;
  stdoutIsTTY: boolean;
}): boolean {
  const ci = options.env['CI'];
  const ciEnabled = Boolean(ci && ci !== '0' && ci.toLowerCase() !== 'false');
  return options.stdinIsTTY
    && options.stdoutIsTTY
    && !ciEnabled
    && options.env['NODEX_NO_DASHBOARD'] !== '1'
    && !options.args.includes('--no-interactive');
}

export function dashboardAction(key: { name?: string; sequence?: string; ctrl?: boolean }): DashboardAction {
  const name = key.name?.toLowerCase();
  if (key.ctrl && name === 'c') return 'quit';
  if (name === 'h' || key.sequence === '?') return 'help';
  if (name === 'r') return 'refresh';
  if (name === 'c') return 'clear';
  if (name === 'l') return 'language';
  if (name === 'q') return 'quit';
  return 'none';
}

function safeText(value: string): string {
  return Array.from(value, (character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 31 || (code >= 127 && code <= 159) ? ' ' : character;
  }).join('').slice(0, 240);
}

function color(enabled: boolean, code: number, text: string): string {
  return enabled ? `\u001b[${code}m${text}\u001b[0m` : text;
}

function statusColor(health: DashboardHealth): number {
  if (health === 'ready') return 32;
  if (health === 'error') return 31;
  return 33;
}

export function renderDashboard(state: DashboardState, ansi = true): string {
  const copy = COPY[state.language];
  const address = safeText(state.address.replace(/\/$/, ''));
  const lines = [
    color(ansi, 1, copy.title),
    '',
    `${color(ansi, statusColor(state.health), '●')} ${copy.status}: ${copy.health[state.health]}`,
    `  ${copy.server}:    ${address}`,
    `  ${copy.responses}: ${address}/v1/responses`,
    `  ${copy.chat}: ${address}/v1/chat/completions`,
    `  ${copy.modelsApi}:    ${address}/v1/models`,
    `  ${copy.healthApi}:    ${address}/healthz`,
    `  ${copy.notion}:    ${copy.notionHealth[state.notion]}`,
    '',
    `${copy.bindings} (${state.bindings.length})`,
  ];

  if (state.bindings.length === 0) {
    lines.push(`  ${copy.noBindings}`);
  } else {
    for (const binding of state.bindings) {
      lines.push(
        `  ${safeText(binding.id)} → ${safeText(binding.agentName)} · ${safeText(binding.notionModel)}`,
      );
    }
  }

  lines.push('', `${copy.logs}: ${safeText(state.logPath)}`, '', color(ansi, 2, copy.helpHint));

  if (state.showHelp) {
    lines.push(
      '',
      color(ansi, 1, `${copy.helpTitle} · ${copy.languageName}`),
      `  H / ?  ${state.language === 'ru' ? 'показать или скрыть помощь' : 'show or hide help'}`,
      `  R      ${state.language === 'ru' ? 'проверить доступ к Notion' : 'check Notion access'}`,
      `  L      ${copy.languageHint}`,
      `  C      ${state.language === 'ru' ? 'перерисовать экран' : 'redraw the screen'}`,
      `  Q      ${state.language === 'ru' ? 'корректно остановить Nodex' : 'stop Nodex gracefully'}`,
    );
  }

  return `${lines.join('\n')}\n`;
}
