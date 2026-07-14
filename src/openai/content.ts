import type { ChatMessageContent } from './types.js';

export function contentToText(content: ChatMessageContent): string {
  if (content == null) return '';
  if (typeof content === 'string') return content;

  return content
    .map((part) => {
      if (typeof part === 'string') return part;

      if (typeof part.text === 'string') return part.text;
      if (typeof part.input_text === 'string') return part.input_text;

      if (typeof part.type === 'string') {
        return `[NODEX: unsupported content part ${part.type}]`;
      }

      return '';
    })
    .filter(Boolean)
    .join('\n');
}