import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { Writable } from 'node:stream';
import { extractCredentials, saveCredentials, type Credentials } from './credentials.js';
import { NodexError } from '../errors.js';

class MutedOutput extends Writable {
  muted = false;

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    if (!this.muted) stdout.write(chunk);
    callback();
  }
}

export async function manualAuth(): Promise<Credentials> {
  stdout.write('Open Notion session storage in DevTools. Values stay hidden while you type.\n');
  const output = new MutedOutput();
  const input = createInterface({ input: stdin, output, terminal: stdin.isTTY && stdout.isTTY });
  const secret = async (label: string): Promise<string> => {
    stdout.write(label);
    output.muted = true;
    try { return (await input.question('')).trim(); }
    finally {
      output.muted = false;
      stdout.write('\n');
    }
  };
  try {
    const token_v2 = await secret('Notion session token: ');
    const notion_browser_id = await secret('Notion browser credential: ');
    if (!token_v2 || !notion_browser_id) {
      throw new NodexError('auth', 'Both hidden Notion credential values are required');
    }
    const credentials = { token_v2, notion_browser_id };
    await saveCredentials(credentials);
    return credentials;
  } finally { input.close(); }
}

export type BrowserAuthStatus = 'opening' | 'checking-session' | 'waiting-for-sign-in' | 'authenticated';
export interface BrowserAuthOptions {
  timeoutMs?: number;
  onStatus?: (status: BrowserAuthStatus) => void;
  forceSignIn?: boolean;
}

export function defaultBrowserProfilePath(): string {
  return join(homedir(), '.nodex', 'browser-profile');
}

export async function browserAuth(options: number | BrowserAuthOptions = {}): Promise<Credentials> {
  const resolvedOptions = typeof options === 'number' ? { timeoutMs: options } : options;
  const timeoutMs = resolvedOptions.timeoutMs ?? 600_000;
  const status = (value: BrowserAuthStatus): void => { resolvedOptions.onStatus?.(value); };
  let playwright: typeof import('playwright');
  try { playwright = await import('playwright'); }
  catch { throw new NodexError('auth', 'Playwright not installed. Run: npm install playwright, or nodex auth --manual'); }
  const profile = defaultBrowserProfilePath();
  let context;
  status('opening');
  try {
    context = await playwright.chromium.launchPersistentContext(profile, { headless: false, channel: 'chrome', args: ['--disable-blink-features=AutomationControlled'] });
  } catch {
    context = await playwright.chromium.launchPersistentContext(profile, { headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  }
  try {
    const credentialUrls = ['https://www.notion.so', 'https://app.notion.com', 'https://www.notion.com'];
    status('checking-session');
    if (resolvedOptions.forceSignIn) {
      await context.clearCookies({ name: /^(?:token_v2|notion_browser_id)$/ });
    } else {
      const existing = extractCredentials(await context.cookies(credentialUrls));
      if (existing) {
        await saveCredentials(existing);
        status('authenticated');
        return existing;
      }
    }
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto('https://www.notion.so/login');
    status('waiting-for-sign-in');
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const found = extractCredentials(await context.cookies(credentialUrls));
      if (found) {
        await saveCredentials(found);
        status('authenticated');
        return found;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new NodexError('auth', 'Timed out waiting for Notion login');
  } finally { await context.close(); }
}
