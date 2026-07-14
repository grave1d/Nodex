import { z } from 'zod';

export const PROTOCOL_VERSION = '1.2';

export const statusEventSchema = z.object({
  type: z.literal('status'),
  text: z.string()
    .min(1)
    .max(200)
    .refine((value) => !/[\r\n]/.test(value), 'status.text must be a single paragraph')
    .refine(
      (value) => !/^\s*(?:#{1,6}\s|[-+*]\s|\d+[.)]\s|>|```|~~~|\|)/.test(value),
      'status.text must not use block Markdown',
    ),
  phase: z.enum(['before_action', 'after_result', 'before_final']).optional(),
}).strict();

export const functionToolCallSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()),
}).strict();

export const customToolCallSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  input: z.string(),
}).strict();

export const toolCallSchema = z.union([functionToolCallSchema, customToolCallSchema]);

export const toolCallEventSchema = z.object({
  type: z.literal('tool_call'),
  calls: z.array(toolCallSchema).min(1),
}).strict();

export const finalEventSchema = z.object({
  type: z.literal('final'),
  text: z.string(),
  summary: z.string().optional(),
}).strict();

export const protocolEventSchema = z.discriminatedUnion('type', [
  statusEventSchema,
  toolCallEventSchema,
  finalEventSchema,
]);

export type StatusEvent = z.infer<typeof statusEventSchema>;
export type ToolCall = z.infer<typeof toolCallSchema>;
export type ToolCallEvent = z.infer<typeof toolCallEventSchema>;
export type FinalEvent = z.infer<typeof finalEventSchema>;
export type ProtocolEvent = z.infer<typeof protocolEventSchema>;

export const PROTOCOL_SPEC = {
  status: {
    schema: statusEventSchema,
    example: {
      type: 'status',
      text: 'Проверяю конфигурацию перед следующим шагом',
      phase: 'before_action',
    },
  },
  tool_call: {
    schema: toolCallEventSchema,
    example: { type: 'tool_call', calls: [{ id: 'call_1', name: 'read_file', arguments: { path: 'README.md' } }] },
  },
  final: {
    schema: finalEventSchema,
    example: { type: 'final', text: 'Готово', summary: 'Необязательный итог' },
  },
} as const;

export const PROTOCOL_RULES = [
  'Каждый calls[].id является call_id и должен быть уникален в пределах turn.',
  'Один tool_call может содержать несколько calls только при PARALLEL_TOOL_CALLS=true.',
  'arguments всегда является JSON-объектом и должен соответствовать parameters выбранной функции.',
  'Для инструмента type=custom вместо arguments передавай строковое поле input без JSON-обёртки.',
  'Результаты вызовов приходят следующим turn как объекты tool_result с тем же tool_call_id.',
  'status описывает только наблюдаемый прогресс: до действия, после результата или перед final.',
  'status не содержит скрытые рассуждения, не дублирует команды и не повторяется без новой информации.',
  'status.text — один короткий абзац без заголовков, списков, таблиц и блоков кода; допустим только лёгкий inline Markdown.',
  'Для каталога type=image_generation используй call name=image_generation и передай prompt в arguments.',
] as const;
