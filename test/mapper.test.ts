import { describe, expect, it } from 'vitest';
import { mapChunks, mapCompletion } from '../src/openai/mapper.js';

describe('openai mapper', () => {
  it('maps final without exposing internal summary', () => {
    const result = mapCompletion(
      [{ type: 'status', text: 'work' }, { type: 'final', text: 'done', summary: 'sum' }],
      'm',
      'id',
    );

    expect(result.choices[0]?.message.content).toBe('done');
    expect(result.choices[0]?.message.content).not.toContain('Итог');
    expect(result.choices[0]?.message.content).not.toContain('sum');
    expect(result.choices[0]?.finish_reason).toBe('stop');
  });

  it('maps multiple tool calls and SSE finish reason', () => {
    const events = [
      {
        type: 'tool_call' as const,
        calls: [
          { id: 'a', name: 'read_file', arguments: { path: 'a' } },
          { id: 'b', name: 'run', arguments: { cmd: 'x' } },
        ],
      },
    ];

    const result = mapCompletion(events, 'm', 'id');

    expect(result.choices[0]?.message.tool_calls).toHaveLength(2);
    expect(result.choices[0]?.finish_reason).toBe('tool_calls');

    const chunks = mapChunks(events, 'm', 'id');
    expect(JSON.stringify(chunks.at(-1))).toContain('tool_calls');
  });

  it('does not stream status events as user-visible content', () => {
    const chunks = mapChunks(
      [{ type: 'status', text: 'work' }, { type: 'final', text: 'done' }],
      'm',
      'id',
    );

    expect(JSON.stringify(chunks)).not.toContain('work');
    expect(JSON.stringify(chunks)).toContain('done');
  });
});