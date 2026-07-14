import { execFile } from 'node:child_process';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { NodexError } from '../errors.js';

export const credentialsSchema = z.object({
  token_v2: z.string().min(1),
  notion_browser_id: z.string().min(1),
}).strict();
export type Credentials = z.infer<typeof credentialsSchema>;
const exec = promisify(execFile);

export function defaultCredentialsPath(): string { return join(homedir(), '.nodex', 'credentials.json'); }

export async function loadCredentials(path = defaultCredentialsPath()): Promise<Credentials> {
  const token = process.env['NODEX_NOTION_TOKEN_V2'];
  const browser = process.env['NODEX_NOTION_BROWSER_ID'];
  if (token || browser) {
    if (!token || !browser) throw new NodexError('auth', 'Both NODEX_NOTION_TOKEN_V2 and NODEX_NOTION_BROWSER_ID are required. Run: nodex auth');
    return { token_v2: token, notion_browser_id: browser };
  }
  try { return credentialsSchema.parse(JSON.parse(await readFile(path, 'utf8'))); }
  catch (error) {
    if (error instanceof NodexError) throw error;
    throw new NodexError('auth', 'Notion credentials missing or invalid. Run: nodex auth');
  }
}

export async function saveCredentials(credentials: Credentials, path = defaultCredentialsPath()): Promise<void> {
  const valid = credentialsSchema.parse(credentials);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(valid, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  try {
    if (process.platform === 'win32') {
      const identity = (await exec('whoami', { encoding: 'utf8' })).stdout.trim();
      if (!identity) throw new Error('Cannot resolve current Windows identity');
      await exec('icacls', [path, '/inheritance:r', '/grant:r', `${identity}:(R,W)`], { encoding: 'utf8' });
    } else await chmod(path, 0o600);
  } catch (error) {
    await rm(path, { force: true });
    throw new NodexError('auth', `Failed to secure credentials file: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

export interface CookieLike { name: string; value: string }
export function extractCredentials(cookies: CookieLike[]): Credentials | undefined {
  const token = cookies.find((cookie) => cookie.name === 'token_v2')?.value;
  const browser = cookies.find((cookie) => cookie.name === 'notion_browser_id')?.value;
  return token && browser ? { token_v2: token, notion_browser_id: browser } : undefined;
}
