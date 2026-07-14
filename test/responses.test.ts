import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { configSchema } from '../src/config.js';
import { buildServer } from '../src/server.js';
import { SessionStore } from '../src/session/store.js';
import type { NotionTransport, TransportRequest } from '../src/transport/types.js';

let directory = '';

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function setup(response: string) {
  directory = await mkdtemp(join(tmpdir(), 'nodex-responses-'));
  const config = configSchema.parse({
    databasePath: join(directory, 'db.sqlite'),
    projectRoot: directory,
    models: { dev: { agentPageId: 'p', agentName: 'Dev', notionModel: 'n' } },
    transport: 'mock',
  });
  const requests: TransportRequest[] = [];
  const transport: NotionTransport = {
    async preflight() {
      return {
        userId: 'u',
        userName: 'User',
        userEmail: 'u@example.invalid',
        workspaceId: 'w',
        workspaceName: 'Workspace',
        spaceViewId: 'v',
      };
    },
    async send(request) {
      requests.push(request);
      return {
        chunks: (async function* () {
          for (const chunk of response.match(/.{1,5}/gs) ?? []) yield chunk;
        })(),
        nextState: '{}',
      };
    },
  };
  const store = new SessionStore(config.databasePath);
  const app = buildServer(config, store, transport);
  await app.ready();
  return { app, requests, store };
}

it('maps multiple Responses function calls without losing strict schemas', async () => {
  const terminal = JSON.stringify({
    type: 'tool_call',
    calls: [
      { id: 'call_a', name: 'read_file', arguments: { path: 'a' } },
      { id: 'call_b', name: 'read_file', arguments: { path: 'b' } },
    ],
  });
  const { app, requests, store } = await setup(terminal);
  const response = await app.inject({
    method: 'POST',
    url: '/v1/responses',
    headers: { 'x-nodex-session-id': 'tools' },
    payload: {
      model: 'dev',
      input: 'read both',
      tools: [
        {
          type: 'function',
          name: 'read_file',
          parameters: { type: 'object', required: ['path'] },
          strict: true,
        },
      ],
    },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().output).toHaveLength(2);
  expect(response.json().output[0].call_id).toBe('call_a');
  expect(requests[0]?.message).toContain('"strict":true');
  await app.close();
  store.close();
});

it('merges Responses Lite additional_tools and preserves freeform custom tools', async () => {
  const execInput = 'const result = await tools.shell_command({command: "pwd"}); text(result);';
  const terminal = JSON.stringify({
    type: 'tool_call',
    calls: [{ id: 'call_exec', name: 'exec', input: execInput }],
  });
  const { app, requests, store } = await setup(terminal);
  const tools = [
    {
      type: 'function',
      name: 'wait',
      description: 'Wait for a yielded exec cell',
      parameters: { type: 'object', properties: { cell_id: { type: 'string' } } },
      strict: true,
    },
    {
      type: 'custom',
      name: 'exec',
      description: 'Run JavaScript that can call nested tools',
      format: { type: 'grammar', syntax: 'lark', definition: 'start: /[\\s\\S]+/' },
    },
  ];
  const first = await app.inject({
    method: 'POST',
    url: '/v1/responses',
    headers: { 'x-nodex-session-id': 'responses-lite' },
    payload: {
      model: 'dev',
      input: [
        { type: 'additional_tools', role: 'developer', tools },
        { role: 'developer', content: 'Base instructions' },
        { role: 'user', content: 'run pwd' },
      ],
    },
  });

  expect(first.statusCode).toBe(200);
  expect(first.json().tools.map((tool: { type: string }) => tool.type)).toEqual(['function', 'custom']);
  expect(first.json().output[0]).toMatchObject({
    type: 'custom_tool_call',
    call_id: 'call_exec',
    name: 'exec',
    input: execInput,
  });
  expect(requests[0]?.message).toContain('"name":"wait"');
  expect(requests[0]?.message).toContain('"type":"custom","name":"exec"');
  expect(requests[0]?.message).not.toContain('"type":"additional_tools"');

  const second = await app.inject({
    method: 'POST',
    url: '/v1/responses',
    headers: { 'x-nodex-session-id': 'responses-lite' },
    payload: {
      model: 'dev',
      input: [
        { type: 'additional_tools', role: 'developer', tools },
        { type: 'custom_tool_call_output', call_id: 'call_exec', output: '/workspace' },
      ],
    },
  });

  expect(second.statusCode).toBe(200);
  expect(requests[1]?.message).toContain('"type":"tool_result"');
  expect(requests[1]?.message).toContain('"tool_call_id":"call_exec"');
  await app.close();
  store.close();
});

it('streams native custom tool call events', async () => {
  const { app, store } = await setup(JSON.stringify({
    type: 'tool_call',
    calls: [{ id: 'call_patch', name: 'apply_patch', input: '*** Begin Patch' }],
  }));
  const response = await app.inject({
    method: 'POST',
    url: '/v1/responses',
    payload: {
      model: 'dev',
      input: 'patch it',
      stream: true,
      tools: [{ type: 'custom', name: 'apply_patch', format: { type: 'text' } }],
    },
  });
  const events = response.body
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)) as {
      type: string;
      call_id?: string;
      item?: { type?: string };
    });

  expect(events.some((event) => event.type === 'response.custom_tool_call_input.delta')).toBe(true);
  expect(events.find((event) => event.type === 'response.custom_tool_call_input.delta')?.call_id)
    .toBe('call_patch');
  expect(events.some((event) => event.type === 'response.custom_tool_call_input.done')).toBe(true);
  expect(events.some((event) => event.item?.type === 'custom_tool_call')).toBe(true);
  await app.close();
  store.close();
});

it('accepts Codex client-side items and tools without forwarding them to Notion', async () => {
  const { app, requests, store } = await setup('{"type":"final","text":"done"}');
  const response = await app.inject({
    method: 'POST',
    url: '/v1/responses',
    payload: {
      model: 'dev',
      metadata: null,
      tool_choice: { type: 'shell' },
      tools: [
        { type: 'shell', environment: { type: 'local' } },
        { type: 'local_shell' },
        { type: 'web_search_preview' },
        { type: 'computer_use_preview' },
        { type: 'browser', viewport: { width: 1280, height: 720 } },
      ],
      input: [
        { type: 'reasoning', id: 'reasoning_1', summary: [], encrypted_content: 'opaque' },
        {
          type: 'shell_call',
          id: 'shell_1',
          call_id: 'call_shell',
          action: { type: 'exec', command: 'pwd' },
          status: 'completed',
        },
        {
          type: 'shell_call_output',
          call_id: 'call_shell',
          output: [{ type: 'stdout', text: '/workspace' }],
          status: 'completed',
        },
        {
          type: 'local_shell_call',
          id: 'local_shell_1',
          call_id: 'call_local_shell',
          action: { command: 'git status --short' },
          status: 'completed',
        },
        {
          type: 'local_shell_call_output',
          call_id: 'call_local_shell',
          output: { stdout: '', exit_code: 0 },
          status: 'completed',
        },
        { type: 'client_context', role: 'developer', content: null },
        {
          type: 'client_context',
          role: 'user',
          content: [
            { type: 'input_text', text: 'continue' },
            { type: 'client_state', value: { cwd: '/workspace' } },
          ],
        },
      ],
    },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().tools).toEqual([]);
  expect(response.json().tool_choice).toBe('auto');
  expect(requests).toHaveLength(1);
  expect(requests[0]?.message).toContain('continue');
  expect(requests[0]?.message).not.toContain('shell_call');
  expect(requests[0]?.message).not.toContain('computer_use_preview');
  await app.close();
  store.close();
});

it('uses the Codex prompt_cache_key to continue one tool session and isolate another', async () => {
  const { app, requests, store } = await setup('{"type":"final","text":"done"}');
  const payload = (promptCacheKey: string, task: string) => ({
    model: 'dev',
    prompt_cache_key: promptCacheKey,
    input: [
      { type: 'message', role: 'user', content: 'stable Codex environment context' },
      { type: 'message', role: 'user', content: task },
    ],
  });

  const first = await app.inject({
    method: 'POST',
    url: '/v1/responses',
    payload: payload('codex-thread-a', 'first turn'),
  });
  const second = await app.inject({
    method: 'POST',
    url: '/v1/responses',
    payload: payload('codex-thread-a', 'tool continuation'),
  });
  const separate = await app.inject({
    method: 'POST',
    url: '/v1/responses',
    payload: payload('codex-thread-b', 'separate task'),
  });

  expect([first.statusCode, second.statusCode, separate.statusCode]).toEqual([200, 200, 200]);
  expect(first.json().prompt_cache_key).toBe('codex-thread-a');
  expect(requests.map((request) => request.newThread)).toEqual([true, false, true]);
  expect(requests[0]?.message).toContain('"type":"message","role":"user"');
  expect(requests[1]?.message).toContain('tool continuation');
  await app.close();
  store.close();
});

it('rejects an unknown Responses function_call_output before transport', async () => {
  const { app, requests, store } = await setup('{"type":"final","text":"unused"}');
  const response = await app.inject({
    method: 'POST',
    url: '/v1/responses',
    headers: { 'x-nodex-session-id': 'tools' },
    payload: {
      model: 'dev',
      input: [{ type: 'function_call_output', call_id: 'missing', output: 'x' }],
    },
  });

  expect(response.statusCode).toBe(400);
  expect(requests).toHaveLength(0);
  await app.close();
  store.close();
});

it('streams a Responses lifecycle with multiple real text deltas', async () => {
  const text = 'A reasonably long streaming answer';
  const { app, store } = await setup(JSON.stringify({ type: 'final', text }));
  const response = await app.inject({
    method: 'POST',
    url: '/v1/responses',
    payload: { model: 'dev', input: 'answer', stream: true },
  });

  expect(response.statusCode).toBe(200);
  const events = response.body
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)) as { type: string; delta?: string });
  expect(events[0]?.type).toBe('response.created');
  expect(events.filter((event) => event.type === 'response.output_text.delta').length).toBeGreaterThan(1);
  expect(
    events
      .filter((event) => event.type === 'response.output_text.delta')
      .map((event) => event.delta)
      .join(''),
  ).toBe(text);
  expect(events.at(-1)?.type).toBe('response.completed');
  await app.close();
  store.close();
});

it('streams status as commentary and final text as final_answer', async () => {
  const upstream =
    '{"type":"status","text":"Проверяю конфигурацию","phase":"before_action"}\n' +
    '{"type":"final","text":"Готово"}';
  const { app, store } = await setup(upstream);
  const response = await app.inject({
    method: 'POST',
    url: '/v1/responses',
    payload: {
      model: 'dev',
      input: 'answer',
      stream: true,
      reasoning: { summary: 'concise' },
    },
  });
  const events = response.body
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)) as {
      type: string;
      delta?: string;
      output_index?: number;
      item?: { phase?: string };
      response?: { output?: Array<{ phase?: string }> };
    });

  const commentaryAdded = events.find(
    (event) => event.type === 'response.output_item.added' && event.item?.phase === 'commentary',
  );
  const finalAdded = events.find(
    (event) => event.type === 'response.output_item.added' && event.item?.phase === 'final_answer',
  );
  expect(commentaryAdded).toBeDefined();
  expect(finalAdded).toBeDefined();
  expect(events.some((event) => event.type.startsWith('response.reasoning_summary'))).toBe(false);
  const final = events
    .filter(
      (event) =>
        event.type === 'response.output_text.delta' &&
        event.output_index === finalAdded?.output_index,
    )
    .map((event) => event.delta)
    .join('');
  expect(final).toBe('Готово');
  expect(final).not.toContain('Проверяю');
  expect(events.at(-1)?.response?.output?.map((item) => item.phase)).toEqual([
    'commentary',
    'final_answer',
  ]);
  await app.close();
  store.close();
});

it('keeps real newlines single-escaped in the final response example', async () => {
  const { app, requests, store } = await setup('{"type":"final","text":"Готово"}');
  await app.inject({
    method: 'POST',
    url: '/v1/responses',
    payload: { model: 'dev', input: 'answer' },
  });

  expect(requests[0]?.message).toContain('## Zanos\\n\\n**Zanos**');
  expect(requests[0]?.message).not.toContain('## Zanos\\\\n');
  await app.close();
  store.close();
});
