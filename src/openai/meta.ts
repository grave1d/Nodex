import { randomUUID } from 'node:crypto';
import { contentToText } from './content.js';
import type { ChatRequest } from './types.js';
import type { ProtocolEvent } from '../protocol/schema.js';

export interface LocalCompletion {
  events: ProtocolEvent[];
  model: string;
  completionId: string;
  responseId: string;
  createdAt: number;
}

function allText(request: ChatRequest): string {
  return request.messages
    .map((message) => contentToText(message.content))
    .filter(Boolean)
    .join('\n\n');
}

function extractUserPrompt(text: string): string {
  const match = text.match(/User prompt:\s*([\s\S]+)$/i);
  return (match?.[1] ?? text).trim();
}

function cleanOneLine(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();
}

function titleFromPrompt(prompt: string): string {
  const text = cleanOneLine(prompt);

  if (/^что это за проект\??$/i.test(text)) return 'Определить проект';
  if (/исправ|почин|ошибк|баг/i.test(text)) return 'Исправить проблему';
  if (/найди|где|locate|find/i.test(text)) return 'Найти в коде';
  if (/добав|созда|add|create/i.test(text)) return 'Добавить функцию';
  if (/объясн|расскаж|что такое|how|why/i.test(text)) return 'Разобраться с вопросом';

  return text.length <= 36 ? text : `${text.slice(0, 33).trim()}...`;
}

export function tryLocalMetaCompletion(request: ChatRequest): LocalCompletion | null {
  const text = allText(request);
  const lower = text.toLowerCase();

  const looksLikeTitleRequest =
    lower.includes('provide a short title') ||
    lower.includes('generate a concise ui title') ||
    lower.includes('the title you generate will be shown in the ui') ||
    lower.includes('just write a title');

  const explicitlyNotARealAnswer =
    lower.includes('do not respond to the user') ||
    lower.includes('do not attempt to solve the problem') ||
    lower.includes('do not attempt to solve') ||
    lower.includes('just write a title');

  if (!looksLikeTitleRequest || !explicitlyNotARealAnswer) return null;

  const prompt = extractUserPrompt(text);
  const title = titleFromPrompt(prompt);

  return {
    model: request.model,
    completionId: `chatcmpl-${randomUUID()}`,
    responseId: `resp_${randomUUID().replaceAll('-', '')}`,
    createdAt: Math.floor(Date.now() / 1000),
    events: [{ type: 'final', text: title }],
  };
}
