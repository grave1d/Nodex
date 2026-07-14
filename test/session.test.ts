import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { SessionStore } from '../src/session/store.js';

let directory = '';
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });
it('persists and replaces sessions across restart', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-db-')); const path = join(directory, 'db.sqlite');
  const first = new SessionStore(path); const session = first.create('s', 't1', 'a'); session.toolsHash = 'h'; first.touch(session); first.close();
  const second = new SessionStore(path); expect(second.get('s', 'a')?.toolsHash).toBe('h'); second.replaceThread(session, 't2'); expect(second.get('s', 'a')?.notionThreadId).toBe('t2'); second.close();
});
