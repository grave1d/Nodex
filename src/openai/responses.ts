import { z } from 'zod';

const metadataSchema = z.preprocess(
  (value) => (value == null ? {} : value),
  z
    .record(z.string().max(64), z.string().max(512))
    .refine((value) => Object.keys(value).length <= 16, 'metadata supports at most 16 keys')
    .default({}),
);

export const responseInputTextSchema = z.looseObject({
  type: z.enum(['input_text', 'output_text', 'text']).default('input_text'),
  text: z.string(),
});

export const responseInputImageSchema = z
  .looseObject({
    type: z.literal('input_image'),
    file_id: z.string().min(1).optional(),
    image_url: z.union([z.string().min(1), z.looseObject({ url: z.string().min(1) })]).optional(),
    detail: z.enum(['auto', 'low', 'high']).default('auto'),
  })
  .refine((value) => Boolean(value.file_id) !== Boolean(value.image_url), {
    message: 'input_image requires exactly one of file_id or image_url',
  });

export const responseInputFileSchema = z
  .looseObject({
    type: z.literal('input_file'),
    file_id: z.string().min(1).optional(),
    filename: z.string().min(1).optional(),
    file_data: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.file_id) !== Boolean(value.file_data), {
    message: 'input_file requires exactly one of file_id or file_data',
  });

export const responseUnknownContentPartSchema = z.looseObject({
  type: z.string().min(1).optional(),
});

export const responseContentPartSchema = z.union([
  z.string(),
  responseInputTextSchema,
  responseInputImageSchema,
  responseInputFileSchema,
  responseUnknownContentPartSchema,
]);

export const responseMessageSchema = z
  .looseObject({
    type: z.literal('message').optional(),
    id: z.string().optional(),
    role: z.string().min(1),
    content: z.union([z.string(), z.null(), z.array(responseContentPartSchema)]).optional(),
    status: z.enum(['in_progress', 'completed', 'incomplete']).optional(),
    phase: z.enum(['commentary', 'final_answer']).optional(),
  })
  .transform((value) => ({ ...value, type: 'message' as const }));

export const responseFunctionCallOutputSchema = z.looseObject({
  type: z.literal('function_call_output'),
  id: z.string().optional(),
  call_id: z.string().min(1).optional(),
  output: z.unknown().optional(),
});

export const responseFunctionCallSchema = z.looseObject({
  type: z.literal('function_call'),
  id: z.string().optional(),
  call_id: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  arguments: z.unknown().optional(),
  status: z.enum(['in_progress', 'completed', 'incomplete']).optional(),
});

export const responseCustomToolCallOutputSchema = z.looseObject({
  type: z.literal('custom_tool_call_output'),
  id: z.string().optional(),
  call_id: z.string().min(1).optional(),
  output: z.unknown().optional(),
});

export const responseCustomToolCallSchema = z.looseObject({
  type: z.literal('custom_tool_call'),
  id: z.string().optional(),
  call_id: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  input: z.unknown().optional(),
  status: z.enum(['in_progress', 'completed', 'incomplete']).optional(),
});

export const responseImageGenerationCallSchema = z.looseObject({
  type: z.literal('image_generation_call'),
  id: z.string().min(1).optional(),
  file_id: z.string().min(1).optional(),
  nodex_file_id: z.string().min(1).optional(),
});

export const responseReasoningItemSchema = z.looseObject({
  type: z.literal('reasoning'),
  id: z.string().min(1).optional(),
  summary: z.array(z.unknown()).optional(),
  content: z.array(z.unknown()).optional(),
  encrypted_content: z.string().optional(),
  status: z.enum(['in_progress', 'completed', 'incomplete']).optional(),
});

export const responseShellCallSchema = z.looseObject({
  type: z.enum(['shell_call', 'local_shell_call']),
  id: z.string().min(1).optional(),
  call_id: z.string().min(1).optional(),
  action: z.unknown().optional(),
  status: z.enum(['in_progress', 'completed', 'incomplete']).optional(),
});

export const responseShellCallOutputSchema = z.looseObject({
  type: z.enum(['shell_call_output', 'local_shell_call_output']),
  id: z.string().min(1).optional(),
  call_id: z.string().min(1).optional(),
  output: z.unknown().optional(),
  status: z.enum(['in_progress', 'completed', 'incomplete']).optional(),
});

export const responseUnknownInputItemSchema = z.union([
  z.string(),
  z.record(z.string(), z.unknown()),
]);

export const responseFunctionToolSchema = z.looseObject({
  type: z.literal('function'),
  name: z.string().min(1),
  description: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).default({}),
  strict: z.boolean().default(false),
});

const responseCustomToolFormatSchema = z.union([
  z.looseObject({ type: z.literal('text') }),
  z.looseObject({
    type: z.literal('grammar'),
    syntax: z.enum(['lark', 'regex']),
    definition: z.string().min(1),
  }),
  z.record(z.string(), z.unknown()),
]);

export const responseCustomToolSchema = z.looseObject({
  type: z.literal('custom'),
  name: z.string().min(1),
  description: z.string().optional(),
  format: responseCustomToolFormatSchema.optional(),
});

export const responseImageGenerationToolSchema = z.looseObject({
  type: z.literal('image_generation'),
  action: z.enum(['auto', 'generate', 'edit']).default('auto'),
  model: z.string().min(1).optional(),
  size: z.string().min(1).default('auto'),
  quality: z.enum(['auto', 'low', 'medium', 'high']).default('auto'),
  background: z.enum(['auto', 'opaque', 'transparent']).default('auto'),
  output_format: z.enum(['png', 'jpeg', 'webp']).default('png'),
  output_compression: z.number().int().min(0).max(100).optional(),
  partial_images: z.number().int().min(0).max(3).default(0),
});

export const responseShellToolSchema = z.looseObject({
  type: z.enum(['shell', 'local_shell']),
  environment: z.unknown().optional(),
});

export const responseHostedToolSchema = z.looseObject({
  type: z.enum([
    'web_search',
    'web_search_preview',
    'file_search',
    'code_interpreter',
    'computer',
    'computer_use_preview',
    'mcp',
  ]),
});

export const responseUnknownToolSchema = z.looseObject({
  type: z.string().min(1),
});

export const responseToolSchema = z.union([
  responseFunctionToolSchema,
  responseCustomToolSchema,
  responseImageGenerationToolSchema,
  responseShellToolSchema,
  responseHostedToolSchema,
  responseUnknownToolSchema,
]);

export const responseAdditionalToolsSchema = z.looseObject({
  type: z.literal('additional_tools'),
  role: z.literal('developer').optional(),
  tools: z.array(responseToolSchema),
});

export const responseInputItemSchema = z.union([
  responseMessageSchema,
  responseFunctionCallSchema,
  responseFunctionCallOutputSchema,
  responseCustomToolCallSchema,
  responseCustomToolCallOutputSchema,
  responseImageGenerationCallSchema,
  responseReasoningItemSchema,
  responseShellCallSchema,
  responseShellCallOutputSchema,
  responseAdditionalToolsSchema,
  responseUnknownInputItemSchema,
]);

const responseToolChoiceSchema = z.preprocess(
  (value) => {
    if (value === 'none' || value === 'auto' || value === 'required') return value;
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (
        (record['type'] === 'function' || record['type'] === 'custom') &&
        typeof record['name'] === 'string' &&
        record['name']
      ) {
        return { type: record['type'], name: record['name'] };
      }
    }
    return 'auto';
  },
  z.union([
    z.enum(['none', 'auto', 'required']),
    z.looseObject({ type: z.enum(['function', 'custom']), name: z.string().min(1) }),
  ]),
);

const conversationSchema = z.union([
  z.string().min(1),
  z.looseObject({ id: z.string().min(1) }),
]);

const reasoningSchema = z.looseObject({
  summary: z.enum(['auto', 'concise', 'detailed', 'none']).optional(),
  effort: z.string().optional(),
  context: z.unknown().optional(),
});

export const responseRequestSchema = z
  .looseObject({
    model: z.string().min(1),
    input: z.union([z.string(), z.array(responseInputItemSchema)]),
    instructions: z.string().optional(),
    stream: z.boolean().default(false),
    metadata: metadataSchema,
    store: z.boolean().default(true),
    previous_response_id: z.string().min(1).optional(),
    conversation: conversationSchema.optional(),
    prompt_cache_key: z.string().min(1).optional(),
    tools: z.array(responseToolSchema).default([]),
    tool_choice: responseToolChoiceSchema.default('auto'),
    parallel_tool_calls: z.boolean().default(true),
    reasoning: reasoningSchema.optional(),
    model_reasoning_summary: z.enum(['auto', 'concise', 'detailed', 'none']).optional(),
    model_supports_reasoning_summaries: z.boolean().optional(),
    background: z.boolean().default(false),
  })
  .refine((value) => !(value.previous_response_id && value.conversation), {
    message: 'conversation and previous_response_id are mutually exclusive',
  });

export type ResponseRequest = z.infer<typeof responseRequestSchema>;
export type ResponseInputItem = z.infer<typeof responseInputItemSchema>;
export type ResponseContentPart = z.infer<typeof responseContentPartSchema>;
export type ResponseFunctionTool = z.infer<typeof responseFunctionToolSchema>;
export type ResponseCustomTool = z.infer<typeof responseCustomToolSchema>;
export type ResponseImageGenerationTool = z.infer<typeof responseImageGenerationToolSchema>;
export type ResponseShellTool = z.infer<typeof responseShellToolSchema>;
export type ResponseHostedTool = z.infer<typeof responseHostedToolSchema>;
export type ResponseTool = z.infer<typeof responseToolSchema>;
