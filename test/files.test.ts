import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { configSchema } from '../src/config.js';
import { FileStore } from '../src/files/store.js';
import { buildServer } from '../src/server.js';
import { SessionStore } from '../src/session/store.js';
import { MockTransport } from '../src/transport/mock.js';

let directory = '';

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

function multipartBody(boundary: string, file: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\nvision\r\n` +
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="screen.png"\r\n` +
        'Content-Type: image/png\r\n\r\n',
    ),
    file,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

it('uploads, retrieves, reads, and deletes a private file', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-files-'));
  const config = configSchema.parse({
    databasePath: join(directory, 'db.sqlite'),
    projectRoot: directory,
    files: { root: join(directory, 'files'), maxBytes: 1024 },
  });
  const store = new SessionStore(config.databasePath);
  const app = buildServer(config, store, new MockTransport());
  await app.ready();
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const boundary = 'nodex-boundary';
  const uploaded = await app.inject({
    method: 'POST',
    url: '/v1/files',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: multipartBody(boundary, png),
  });
  expect(uploaded.statusCode).toBe(200);
  const file = uploaded.json() as { id: string };
  expect(file.id).toMatch(/^file_/);

  const content = await app.inject({ method: 'GET', url: `/v1/files/${file.id}/content` });
  expect(content.rawPayload).toEqual(png);
  expect(
    (await app.inject({ method: 'DELETE', url: `/v1/files/${file.id}` })).json().deleted,
  ).toBe(true);
  expect((await app.inject({ method: 'GET', url: `/v1/files/${file.id}` })).statusCode).toBe(404);
  await app.close();
  store.close();
});

it('rejects sensitive filenames before creating metadata', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-files-'));
  const config = configSchema.parse({
    databasePath: join(directory, 'db.sqlite'),
    files: { root: join(directory, 'files'), maxBytes: 1024 },
  });
  const store = new SessionStore(config.databasePath);
  const files = new FileStore(config.files, store);
  await expect(
    files.upload(
      (async function* () {
        yield Buffer.from('secret');
      })(),
      { filename: '.env', purpose: 'user_data', mimeType: 'text/plain' },
    ),
  ).rejects.toMatchObject({ code: 'invalid_request' });
  expect(store.listFiles()).toHaveLength(0);
  store.close();
});
