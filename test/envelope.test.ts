import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { buildEnvelope } from '../src/context/envelope.js';

let directory = '';
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });
it('bounds UTF-8 envelope and excludes secrets/service trees', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-envelope-')); await mkdir(join(directory, 'node_modules')); await writeFile(join(directory, 'node_modules', 'secret'), 'x');
  for (let i = 0; i < 30; i += 1) await writeFile(join(directory, `файл-${i}.txt`), 'x');
  const envelope = await buildEnvelope(directory, { maxDepth: 3, maxEntries: 50, maxBytes: 300 });
  const encoded = JSON.stringify(envelope); expect(Buffer.byteLength(encoded, 'utf8')).toBeLessThanOrEqual(300); expect(encoded).not.toContain('secret');
});
