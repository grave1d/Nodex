import { protocolEventSchema, type ProtocolEvent } from './schema.js';

interface ScannedObject {
  raw: string;
  complete: boolean;
}

function scanObjects(input: string): ScannedObject[] {
  const objects: ScannedObject[] = [];
  let start = -1;
  let depth = 0;
  let quote = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index] ?? '';

    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quote = false;
      continue;
    }

    if (depth > 0 && char === '"') {
      quote = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }

    if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push({ raw: input.slice(start, index + 1), complete: true });
        start = -1;
      }
    }
  }

  if (start >= 0) objects.push({ raw: input.slice(start), complete: false });
  return objects;
}

function decodedStringPrefix(raw: string): string {
  let safe = '';

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index] ?? '';

    if (char === '"') break;

    if (char !== '\\') {
      safe += char;
      continue;
    }

    const escape = raw[index + 1];
    if (!escape) break;

    if (escape === 'u') {
      const hex = raw.slice(index + 2, index + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) break;
      safe += `\\u${hex}`;
      index += 5;
      continue;
    }

    if (!['"', '\\', '/', 'b', 'f', 'n', 'r', 't'].includes(escape)) break;
    safe += `\\${escape}`;
    index += 1;
  }

  try {
    let decoded = JSON.parse(`"${safe}"`) as string;
    const last = decoded.charCodeAt(decoded.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) decoded = decoded.slice(0, -1);
    return decoded;
  } catch {
    return '';
  }
}

function partialFinalText(raw: string): string | undefined {
  if (!/"type"\s*:\s*"final"/.test(raw)) return undefined;
  const match = /"text"\s*:\s*"/.exec(raw);
  if (!match) return undefined;
  return decodedStringPrefix(raw.slice(match.index + match[0].length));
}

export interface IncrementalUpdate {
  events: ProtocolEvent[];
  textDelta?: string;
}

export class IncrementalProtocolParser {
  private raw = '';
  private completeCount = 0;
  private streamedText = '';

  push(chunk: string): IncrementalUpdate {
    this.raw += chunk;
    const objects = scanObjects(this.raw);
    const complete = objects.filter((object) => object.complete);
    const events: ProtocolEvent[] = [];

    for (const object of complete.slice(this.completeCount)) {
      try {
        const parsed = protocolEventSchema.safeParse(JSON.parse(object.raw) as unknown);
        if (parsed.success) events.push(parsed.data);
      } catch {
        // Full validation and repair remain the responsibility of parseProtocol at EOF.
      }
    }

    this.completeCount = complete.length;

    const candidate = objects.at(-1);
    const text = candidate ? partialFinalText(candidate.raw) : undefined;
    let textDelta: string | undefined;

    if (text !== undefined && text.startsWith(this.streamedText)) {
      const next = text.slice(this.streamedText.length);
      if (next) textDelta = next;
      this.streamedText = text;
    }

    return { events, ...(textDelta ? { textDelta } : {}) };
  }

  get value(): string {
    return this.raw;
  }

  get emittedText(): string {
    return this.streamedText;
  }
}
