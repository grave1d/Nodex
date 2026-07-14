import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { configSchema } from '../src/config.js';
import { buildServer } from '../src/server.js';
import { SessionStore } from '../src/session/store.js';
import { MockTransport } from '../src/transport/mock.js';
import type { TransportRequest, TransportTurn } from '../src/transport/types.js';

let directory = '';
afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

class CountingTransport extends MockTransport {
  calls = 0;
  override async send(request: TransportRequest): Promise<TransportTurn> {
    this.calls += 1;
    return super.send(request);
  }
}

async function setup(transport = new CountingTransport()) {
  directory = await mkdtemp(join(tmpdir(), 'nodex-response-state-'));
  const config = configSchema.parse({
    databasePath: join(directory, 'db.sqlite'),
    projectRoot: directory,
    transport: 'mock',
    models: { dev: { agentPageId: 'page', agentName: 'Dev', notionModel: 'model' } },
  });
  const store = new SessionStore(config.databasePath);
  const app = buildServer(config, store, transport);
  await app.ready();
  return { app, store, transport };
}

it('deduplicates a response by Idempotency-Key and supports retrieve/input/delete', async () => {
  const { app, store, transport } = await setup();
  const request = {
    method: 'POST' as const,
    url: '/v1/responses',
    headers: { 'idempotency-key': 'same-turn' },
    payload: { model: 'dev', input: 'NO_TOOL' },
  };
  const first = await app.inject(request);
  const second = await app.inject(request);
  const id = first.json().id as string;

  expect(second.json().id).toBe(id);
  expect(transport.calls).toBe(1);
  expect((await app.inject({ method: 'GET', url: `/v1/responses/${id}` })).statusCode).toBe(200);
  expect(
    (await app.inject({ method: 'GET', url: `/v1/responses/${id}/input_items` })).json().data,
  ).toHaveLength(1);
  expect((await app.inject({ method: 'DELETE', url: `/v1/responses/${id}` })).json().deleted)
    .toBe(true);
  await app.close();
  store.close();
});

it('continues stored context with previous_response_id without carrying instructions', async () => {
  const { app, store, transport } = await setup();
  const first = await app.inject({
    method: 'POST',
    url: '/v1/responses',
    payload: { model: 'dev', input: 'NO_TOOL', instructions: 'first-only' },
  });
  const second = await app.inject({
    method: 'POST',
    url: '/v1/responses',
    payload: {
      model: 'dev',
      input: 'NO_TOOL again',
      previous_response_id: first.json().id,
    },
  });

  expect(second.statusCode).toBe(200);
  expect(transport.calls).toBe(2);
  await app.close();
  store.close();
});

it('does not expose store=false responses through retrieve', async () => {
  const { app, store } = await setup();
  const created = await app.inject({
    method: 'POST',
    url: '/v1/responses',
    payload: { model: 'dev', input: 'NO_TOOL', store: false },
  });
  const retrieved = await app.inject({
    method: 'GET',
    url: `/v1/responses/${created.json().id as string}`,
  });
  expect(retrieved.statusCode).toBe(404);
  await app.close();
  store.close();
});

it('cancels a running background response and keeps cancellation terminal', async () => {
  class SlowTransport extends MockTransport {
    override async send(request: TransportRequest): Promise<TransportTurn> {
      return {
        chunks: (async function* () {
          await new Promise<void>((resolve, reject) => {
            if (request.signal.aborted) {
              reject(new Error('aborted'));
              return;
            }
            request.signal.addEventListener('abort', () => reject(new Error('aborted')), {
              once: true,
            });
          });
          yield JSON.stringify({ type: 'final', text: 'too late' });
        })(),
        nextState: '{}',
      };
    }
  }
  const { app, store } = await setup(new SlowTransport() as CountingTransport);
  const started = await app.inject({
    method: 'POST',
    url: '/v1/responses',
    payload: { model: 'dev', input: 'wait', background: true },
  });
  const id = started.json().id as string;
  expect(started.json().background).toBe(true);
  const cancelled = await app.inject({
    method: 'POST',
    url: `/v1/responses/${id}/cancel`,
  });
  const repeated = await app.inject({
    method: 'POST',
    url: `/v1/responses/${id}/cancel`,
  });

  expect(cancelled.json().status).toBe('cancelled');
  expect(repeated.json().status).toBe('cancelled');
  await app.close();
  store.close();
});
