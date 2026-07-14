import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { decodeNotionStream, workflowPageMap } from '../src/transport/notion.js';
import { parseProtocol } from '../src/protocol/parser.js';

it('decodes anonymized Notion patch fixture', async () => {
  const bytes = await readFile(new URL('./fixtures/notion-success.ndjson', import.meta.url));
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes.subarray(0, 37)); controller.enqueue(bytes.subarray(37)); controller.close(); } });
  let text = ''; for await (const chunk of decodeNotionStream(body, new AbortController().signal)) text += chunk;
  expect(parseProtocol(text).events.map((event) => event.type)).toEqual(['status', 'final']);
});

it('decodes anonymized custom tool fixture without JSON-wrapping its input', async () => {
  const bytes = await readFile(new URL('./fixtures/notion-custom-tool.ndjson', import.meta.url));
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  let text = '';
  for await (const chunk of decodeNotionStream(body, new AbortController().signal)) text += chunk;
  const terminal = parseProtocol(text).events.at(-1);
  expect(terminal).toMatchObject({
    type: 'tool_call',
    calls: [{ id: 'call_patch', name: 'apply_patch', input: '*** Begin Patch\n*** End Patch' }],
  });
});

it('decodes final NDJSON record without trailing newline', async () => {
  const line = JSON.stringify({ type: 'agent-inference', value: [{ type: 'text', content: '{"type":"final","text":"done"}' }] });
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(line)); controller.close(); } });
  let text = ''; for await (const chunk of decodeNotionStream(body, new AbortController().signal)) text += chunk;
  expect(parseProtocol(text).events.at(-1)?.type).toBe('final');
});

it('resolves Custom Agent instructions page to workflow', () => {
  const response = { recordMap: { workflow: { workflow1: { value: { value: { data: { instructions: { id: 'page1' } } } } } } } };
  expect(workflowPageMap(response).get('page1')).toBe('workflow1');
});

it('classifies embedded trust-rule denial', async () => {
  const line = `${JSON.stringify({ type: 'patch-start', data: { s: [{ type: 'error', subType: 'trust-rule-denied', message: 'back off' }] } })}\n`;
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(line)); controller.close(); } });
  const read = async () => { for await (const _chunk of decodeNotionStream(body, new AbortController().signal)) { /* drain */ } };
  await expect(read()).rejects.toMatchObject({ code: 'trust_backoff' });
});
