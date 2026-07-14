import { protocolEventSchema, type ProtocolEvent } from './schema.js';

export interface ParseResult {
  events: ProtocolEvent[];
  ignoredTypes: string[];
}

function registerCallIds(
  calls: Extract<ProtocolEvent, { type: 'tool_call' }>['calls'],
  ids: Set<string>,
): void {
  for (const call of calls) {
    if (ids.has(call.id)) throw new Error('protocol_duplicate_call_id');
    ids.add(call.id);
  }
}

function scanObjects(input: string): string[] {
  const out: string[] = [];
  let start = -1;
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i] ?? '';
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (depth > 0 && (char === '"' || char === "'")) { quote = char; continue; }
    if (char === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) { out.push(input.slice(start, i + 1)); start = -1; }
    }
  }
  if (start >= 0) out.push(input.slice(start));
  return out;
}

function closeBrackets(input: string): string {
  let braces = 0;
  let brackets = 0;
  let quote = '';
  let escaped = false;
  for (const char of input) {
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '{') braces += 1;
    else if (char === '}') braces -= 1;
    else if (char === '[') brackets += 1;
    else if (char === ']') brackets -= 1;
  }
  return input + ']'.repeat(Math.max(0, brackets)) + '}'.repeat(Math.max(0, braces));
}

export function repairJson(input: string): string {
  let repaired = input.trim().replace(/,\s*([}\]])/g, '$1');
  repaired = repaired.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, body: string) =>
    JSON.stringify(body.replace(/\\'/g, "'")));
  return closeBrackets(repaired);
}

export function parseProtocol(input: string): ParseResult {
  const events: ProtocolEvent[] = [];
  const ignoredTypes: string[] = [];
  const ids = new Set<string>();
  let terminal = false;
  for (const candidate of scanObjects(input.replace(/```(?:json)?/gi, ''))) {
    let value: unknown;
    try { value = JSON.parse(candidate); }
    catch {
      try { value = JSON.parse(repairJson(candidate)); }
      catch { continue; }
    }
    if (!value || typeof value !== 'object') continue;
    const rawType = (value as { type?: unknown }).type;
    if (typeof rawType === 'string' && !['status', 'tool_call', 'final'].includes(rawType)) {
      ignoredTypes.push(rawType);
      continue;
    }
    const parsed = protocolEventSchema.safeParse(value);
    if (!parsed.success) continue;
    if (terminal) throw new Error('protocol_event_after_terminal');
    if (parsed.data.type === 'tool_call') {
      registerCallIds(parsed.data.calls, ids);
      terminal = true;
    } else if (parsed.data.type === 'final') terminal = true;
    events.push(parsed.data);
  }
  return { events, ignoredTypes };
}

export function assertCompleteTurn(events: ProtocolEvent[]): void {
  const terminals = events.filter((event) => event.type !== 'status');
  if (terminals.length !== 1 || events.at(-1)?.type === 'status') {
    throw new Error('protocol_missing_or_multiple_terminal');
  }
}
