import { z } from 'zod';

const tokenArraySchema = z.array(z.number().int().nonnegative()).min(1);

export const embeddingRequestSchema = z
  .object({
    model: z.string().min(1),
    input: z.union([
      z.string().min(1),
      z.array(z.string().min(1)).min(1),
      tokenArraySchema,
      z.array(tokenArraySchema).min(1),
    ]),
    encoding_format: z.enum(['float', 'base64']).default('float'),
    dimensions: z.number().int().positive().optional(),
    user: z.string().min(1).max(64).optional(),
  })
  .strict();
