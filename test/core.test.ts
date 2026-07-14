import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { configSchema } from '../src/config.js';
import { NodexCore } from '../src/core.js';
import { NodexError } from '../src/errors.js';
import { chatRequestSchema } from '../src/openai/types.js';
import { SessionStore } from '../src/session/store.js';
import { MockTransport } from '../src/transport/mock.js';
import type { NotionTransport, TransportRequest } from '../src/transport/types.js';

let directory = '';
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });
it('completes read/edit/command tool cycles in same session', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-core-'));
  const config = configSchema.parse({ databasePath: join(directory, 'db.sqlite'), projectRoot: directory, models: { dev: { agentPageId: 'p', agentName: 'Dev', notionModel: 'n' } }, transport: 'mock' });
  const store = new SessionStore(config.databasePath); const core = new NodexCore(config, store, new MockTransport());
  const tools = ['read_file', 'edit_file', 'run_command'].map((name) => ({ type: 'function' as const, function: { name, parameters: {} } }));
  let messages: Array<{ role: 'user' | 'tool'; content: string; tool_call_id?: string }> = [{ role: 'user', content: 'work' }];
  for (const expected of ['read_file', 'edit_file', 'run_command']) {
    const result = await core.run(chatRequestSchema.parse({ model: 'dev', messages, tools }), 'session');
    const terminal = result.events.at(-1); expect(terminal?.type).toBe('tool_call');
    if (terminal?.type !== 'tool_call') throw new Error('missing tool call');
    expect(terminal.calls[0]?.name).toBe(expected);
    messages = [{ role: 'tool', tool_call_id: terminal.calls[0]!.id, content: `${expected} result` }];
  }
  const done = await core.run(chatRequestSchema.parse({ model: 'dev', messages, tools }), 'session');
  expect(done.events.at(-1)?.type).toBe('final'); await core.close(); store.close();
});

it('rejects unknown tool result id before transport', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-core-'));
  const config = configSchema.parse({ databasePath: join(directory, 'db.sqlite'), projectRoot: directory, models: { dev: { agentPageId: 'p', agentName: 'Dev', notionModel: 'n' } }, transport: 'mock' });
  const store = new SessionStore(config.databasePath); const core = new NodexCore(config, store, new MockTransport());
  await expect(core.run(chatRequestSchema.parse({ model: 'dev', messages: [{ role: 'tool', tool_call_id: 'missing', content: 'x' }] }), 'session')).rejects.toMatchObject({ code: 'invalid_request' });
  await core.close(); store.close();
});

it('resends protocol preamble and full tools after thread replacement', async () => {
  directory = await mkdtemp(join(tmpdir(), 'nodex-core-'));
  const config = configSchema.parse({ databasePath: join(directory, 'db.sqlite'), projectRoot: directory, models: { dev: { agentPageId: 'p', agentName: 'Dev', notionModel: 'n' } }, transport: 'mock' });
  const requests: TransportRequest[] = [];
  const transport: NotionTransport = {
    async preflight() { return { userId: 'u', userName: 'User', userEmail: 'u@example.com', workspaceId: 'w', workspaceName: 'Workspace', spaceViewId: 'v' }; },
    async send(request) {
      requests.push(request);
      if (requests.length === 2) throw new NodexError('thread_not_found', 'gone');
      return { chunks: (async function* () { yield '{"type":"final","text":"done"}'; })(), nextState: '{"ok":true}' };
    },
  };
  const store = new SessionStore(config.databasePath); const core = new NodexCore(config, store, transport);
  const tools = [{ type: 'function' as const, function: { name: 'read_file', parameters: { type: 'object' } } }];
  await core.run(chatRequestSchema.parse({ model: 'dev', messages: [{ role: 'user', content: 'first' }], tools }), 'session');
  await core.run(chatRequestSchema.parse({ model: 'dev', messages: [{ role: 'user', content: 'second' }], tools }), 'session');
  expect(requests[1]?.message).not.toContain('NODEX_PROTOCOL');
  expect(requests[2]?.newThread).toBe(true);
  expect(requests[2]?.message).toContain('NODEX_PROTOCOL');
  expect(requests[2]?.message).toContain('"name":"read_file"');
  await core.close(); store.close();
});
