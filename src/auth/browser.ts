import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { extractCredentials, saveCredentials, type Credentials } from './credentials.js';
import { NodexError } from '../errors.js';

export async function manualAuth(): Promise<Credentials> {
  stdout.write('DevTools → Application → Cookies → https://www.notion.so\n');
  const input = createInterface({ input: stdin, output: stdout });
  try {
    const token_v2 = (await input.question('token_v2: ')).trim();
    const notion_browser_id = (await input.question('notion_browser_id: ')).trim();
    const credentials = { token_v2, notion_browser_id };
    await saveCredentials(credentials);
    return credentials;
  } finally { input.close(); }
}

export async function browserAuth(timeoutMs = 600_000): Promise<Credentials> {
  let playwright: typeof import('playwright');
  try { playwright = await import('playwright'); }
  catch { throw new NodexError('auth', 'Playwright not installed. Run: npm install playwright, or nodex auth --manual'); }
  const profile = join(homedir(), '.nodex', 'browser-profile');
  let context;
  try {
    context = await playwright.chromium.launchPersistentContext(profile, { headless: false, channel: 'chrome', args: ['--disable-blink-features=AutomationControlled'] });
  } catch {
    context = await playwright.chromium.launchPersistentContext(profile, { headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  }
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto('https://www.notion.so/login');
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const found = extractCredentials(await context.cookies(['https://www.notion.so', 'https://app.notion.com', 'https://www.notion.com']));
      if (found) { await saveCredentials(found); return found; }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new NodexError('auth', 'Timed out waiting for Notion login');
  } finally { await context.close(); }
}
