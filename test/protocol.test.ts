import { describe, expect, it } from 'vitest';
import { assertCompleteTurn, parseProtocol, repairJson } from '../src/protocol/parser.js';
import { generateProtocolPreamble } from '../src/protocol/preamble.js';
import { PROTOCOL_RULES, PROTOCOL_SPEC } from '../src/protocol/schema.js';

describe('protocol parser', () => {
  it.each([
    ['ndjson', '{"type":"status","text":"ok"}\n{"type":"final","text":"done"}', 2],
    ['several objects', 'x {"type":"status","text":"{x}"} y {"type":"final","text":"done"}', 2],
    ['fences', '```json\n{"type":"final","text":"done"}\n```', 1],
    ['apostrophe in prose', `Here's result: {"type":"final","text":"done"}`, 1],
    ['trailing comma', "{'type':'final','text':'done',}", 1],
    ['unclosed', '{"type":"final","text":"done"', 1],
    ['unknown', '{"type":"future"}{"type":"final","text":"done"}', 1],
  ])('%s', (_name, input, count) => expect(parseProtocol(input).events).toHaveLength(count));
  it('keeps valid JSON unchanged during repair', () => expect(repairJson('{"x":"a,b"}')).toBe('{"x":"a,b"}'));
  it('rejects duplicate IDs', () => expect(() => parseProtocol('{"type":"tool_call","calls":[{"id":"x","name":"a","arguments":{}},{"id":"x","name":"b","arguments":{}}]}')).toThrow('duplicate'));
  it('rejects events after terminal', () => expect(() => parseProtocol('{"type":"final","text":"done"}{"type":"status","text":"late"}')).toThrow('after_terminal'));
  it('requires terminal', () => expect(() => assertCompleteTurn(parseProtocol('{"type":"status","text":"x"}').events)).toThrow());
  it('accepts freeform custom tool input', () => {
    const events = parseProtocol('{"type":"tool_call","calls":[{"id":"x","name":"apply_patch","input":"*** Begin Patch\\n*** End Patch"}]}').events;
    expect(events.at(-1)).toMatchObject({ type: 'tool_call', calls: [{ name: 'apply_patch' }] });
  });
  it('drops block-formatted status commentary', () => {
    const events = parseProtocol('{"type":"status","text":"## Работа"}\n{"type":"final","text":"done"}').events;
    expect(events).toEqual([{ type: 'final', text: 'done' }]);
  });
});

it('generates preamble from schema-owned examples', () => {
  const preamble = generateProtocolPreamble();
  for (const [type, entry] of Object.entries(PROTOCOL_SPEC)) {
    expect(preamble).toContain(`"type":"${type}"`);
    expect(entry.schema.safeParse(entry.example).success).toBe(true);
  }
  for (const rule of PROTOCOL_RULES) expect(preamble).toContain(rule);
});
