import { z } from 'zod';

const common = {
  model: z.string().min(1),
  prompt: z.string().min(1).max(32_000),
  n: z.coerce.number().int().min(1).max(10).default(1),
  size: z.string().min(1).default('auto'),
  quality: z.enum(['auto', 'low', 'medium', 'high']).default('auto'),
  background: z.enum(['auto', 'opaque', 'transparent']).default('auto'),
  output_format: z.enum(['png', 'jpeg', 'webp']).default('png'),
  output_compression: z.coerce.number().int().min(0).max(100).optional(),
  response_format: z.literal('b64_json').default('b64_json'),
};

export const imageGenerationRequestSchema = z.object({
  ...common,
  stream: z.literal(false).default(false),
  partial_images: z.literal(0).default(0),
}).strict();

export const imageEditFieldsSchema = z.object(common).strict();
