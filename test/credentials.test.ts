import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { extractCredentials, loadCredentials, saveCredentials } from '../src/auth/credentials.js';

let directory = '';
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });
it('extracts and saves both cookies unchanged', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-auth-')); const path = join(directory, 'credentials.json');
  const value = extractCredentials([{ name: 'token_v2', value: 'v03%3Aabc' }, { name: 'notion_browser_id', value: 'browser' }]);
  expect(value?.token_v2).toBe('v03%3Aabc');
  await saveCredentials(value!, path);
  expect(await loadCredentials(path)).toEqual(value);
  expect(await readFile(path, 'utf8')).not.toContain('v03:abc');
});
