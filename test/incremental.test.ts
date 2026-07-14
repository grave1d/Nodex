import { expect, it } from 'vitest';
import { IncrementalProtocolParser } from '../src/protocol/incremental.js';

it('streams only final.text and preserves split escapes and unicode', () => {
  const parser = new IncrementalProtocolParser();
  const input =
    '{"type":"status","text":"hidden"}\n' +
    '{"type":"final","text":"line\\nemoji \\uD83D\\uDE00 quoted \\"ok\\""}';
  const deltas: string[] = [];

  for (const chunk of input.match(/.{1,3}/gs) ?? []) {
    const update = parser.push(chunk);
    if (update.textDelta) deltas.push(update.textDelta);
  }

  expect(deltas.join('')).toBe('line\nemoji 😀 quoted "ok"');
  expect(deltas.join('')).not.toContain('hidden');
});
