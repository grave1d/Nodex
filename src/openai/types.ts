import { z } from 'zod';

const contentPartSchema = z
  .object({
    type: z.string().optional(),
    text: z.string().optional(),
    input_text: z.string().optional(),
  })
  .loose();

export const messageContentSchema = z
  .union([
    z.string(),
    z.null(),
    z.array(z.union([z.string(), contentPartSchema])),
  ])
  .optional();

const messageSchema = z
  .object({
    role: z.enum(['system', 'developer', 'user', 'assistant', 'tool']),
    content: messageContentSchema,
    tool_call_id: z.string().optional(),
    tool_calls: z
      .array(
        z.object({
          id: z.string(),
          type: z.literal('function'),
          function: z.object({
            name: z.string(),
            arguments: z.string(),
          }),
        }),
      )
      .optional(),
  })
  .loose();

const functionToolSchema = z
  .object({
    type: z.literal('function'),
    function: z
      .object({
        name: z.string().min(1),
        description: z.string().optional(),
        parameters: z.record(z.string(), z.unknown()).optional(),
        strict: z.boolean().optional(),
      })
      .loose(),
  })
  .loose();

export const chatRequestSchema = z
  .object({
    model: z.string().min(1),
    messages: z.array(messageSchema).min(1),
    stream: z.boolean().default(false),
    tools: z.array(functionToolSchema).default([]),
    tool_choice: z
      .union([
        z.enum(['none', 'auto', 'required']),
        z.object({
          type: z.literal('function'),
          function: z.object({ name: z.string() }),
        }),
      ])
      .default('auto'),
  })
  .loose();

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatMessageContent = z.infer<typeof messageContentSchema>;
