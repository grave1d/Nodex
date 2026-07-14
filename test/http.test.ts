import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { configSchema } from '../src/config.js';
import { buildServer } from '../src/server.js';
import { SessionStore } from '../src/session/store.js';
import { MockTransport } from '../src/transport/mock.js';

let directory = '';
afterEach(async () => { delete process.env['NODEX_API_KEY']; if (directory) await rm(directory, { recursive: true, force: true }); });
async function setup() {
  directory = await mkdtemp(join(tmpdir(), 'nodex-http-'));
  const config = configSchema.parse({ databasePath: join(directory, 'db.sqlite'), projectRoot: directory, models: { dev: { agentPageId: 'p', agentName: 'Dev', notionModel: 'n' } }, transport: 'mock', keepAliveMs: 20 });
  const store = new SessionStore(config.databasePath); const app = buildServer(config, store, new MockTransport()); await app.ready();
  return { app, store };
}
const body = { model: 'dev', messages: [{ role: 'user', content: 'NO_TOOL' }] };

it('serves models and non-stream completion', async () => {
  const { app, store } = await setup();
  const catalog = (await app.inject({
    method: 'GET',
    url: '/v1/models?client_version=0.144.3',
  })).json();
  expect(catalog.data[0].id).toBe('dev');
  expect(catalog.models).toEqual([]);
  const response = await app.inject({ method: 'POST', url: '/v1/chat/completions', payload: body });
  expect(response.statusCode).toBe(200); expect(response.json().choices[0].finish_reason).toBe('stop');
  await app.close(); store.close();
});

it('streams role first, terminal chunk, and DONE', async () => {
  const { app, store } = await setup();
  const response = await app.inject({ method: 'POST', url: '/v1/chat/completions', payload: { ...body, stream: true } });
  const data = response.body.split('\n').filter((line) => line.startsWith('data: '));
  expect(data[0]).toContain('"role":"assistant"'); expect(data.at(-2)).toContain('"finish_reason":"stop"'); expect(data.at(-1)).toBe('data: [DONE]');
  await app.close(); store.close();
});

it('enforces local API key', async () => {
  process.env['NODEX_API_KEY'] = 'secret'; const { app, store } = await setup();
  expect((await app.inject({ method: 'GET', url: '/v1/models' })).statusCode).toBe(401);
  expect((await app.inject({ method: 'GET', url: '/v1/models', headers: { authorization: 'Bearer secret' } })).statusCode).toBe(200);
  await app.close(); store.close();
});

it('echoes a safe request id and blocks CORS unless explicitly configured', async () => {
  const { app, store } = await setup();
  const traced = await app.inject({
    method: 'GET',
    url: '/v1/models',
    headers: { 'x-request-id': 'req-client-1' },
  });
  expect(traced.headers['x-request-id']).toBe('req-client-1');
  const crossOrigin = await app.inject({
    method: 'GET',
    url: '/v1/models',
    headers: { origin: 'https://untrusted.example' },
  });
  expect(crossOrigin.statusCode).toBe(403);
  expect(crossOrigin.json().error.type).toBe('permission_error');
  await app.close(); store.close();
});

it('rejects excessive input items before opening a transport turn', async () => {
  const { app, store } = await setup();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/responses',
    payload: {
      model: 'dev',
      input: Array.from({ length: 257 }, (_, index) => ({
        type: 'message',
        role: 'user',
        content: `item ${index}`,
      })),
    },
  });
  expect(response.statusCode).toBe(400);
  expect(response.json().error.code).toBe('invalid_request');
  await app.close(); store.close();
});

it('returns HTTP error when streaming fails before first SSE event', async () => {
  const { app, store } = await setup();
  const response = await app.inject({ method: 'POST', url: '/v1/chat/completions', payload: { ...body, model: 'missing', stream: true } });
  expect(response.statusCode).toBe(400); expect(response.headers['content-type']).toContain('application/json');
  await app.close(); store.close();
});
