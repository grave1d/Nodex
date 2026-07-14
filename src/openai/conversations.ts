import { z } from 'zod';
import { responseInputItemSchema } from './responses.js';

const metadataSchema = z
  .record(z.string().max(64), z.string().max(512))
  .refine((value) => Object.keys(value).length <= 16, 'metadata supports at most 16 keys')
  .default({});

export const conversationCreateSchema = z
  .object({
    metadata: metadataSchema,
    items: z.array(responseInputItemSchema).default([]),
  })
  .strict();

export const conversationUpdateSchema = z
  .object({ metadata: metadataSchema })
  .strict();

export const conversationItemsCreateSchema = z
  .object({ items: z.array(responseInputItemSchema).min(1).max(100) })
  .strict();

export const conversationItemsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  after: z.string().min(1).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});
