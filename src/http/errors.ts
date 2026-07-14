import type { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { EmbeddingProviderError } from '../embeddings/provider.js';
import { NodexError, type NodexErrorCode } from '../errors.js';
import { ImageProviderError } from '../images/provider.js';

export interface OpenAIErrorObject {
  message: string;
  type: string;
  param: string | null;
  code: string;
  request_id?: string;
}

export interface ApiErrorMapping {
  status: number;
  error: OpenAIErrorObject;
  retryAfterSeconds?: number;
  log: {
    requestId?: string;
    code: string;
    status: number;
    errorName: string;
  };
}

function sanitizeMessage(value: string): string {
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/(token_v2|notion_browser_id|cookie|authorization)\s*[=:]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/data:[^;,\s]+;base64,[A-Za-z0-9+/=_-]+/gi, '[base64 omitted]')
    .replace(/[A-Za-z0-9+/=_-]{160,}/g, '[large value omitted]')
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[private id]')
    .slice(0, 512);
}

function providerCode(error: ImageProviderError | EmbeddingProviderError): NodexErrorCode {
  if (error.code === 'disabled') return 'capability_unavailable';
  if (error.code === 'provider_error') return 'upstream_protocol';
  return error.code;
}

function statusForCode(code: NodexErrorCode): number {
  if (code === 'invalid_request') return 400;
  if (code === 'auth') return 401;
  if (code === 'forbidden') return 403;
  if (code === 'not_found' || code === 'thread_not_found') return 404;
  if (code === 'conflict') return 409;
  if (code === 'payload_too_large') return 413;
  if (code === 'rate_limit' || code === 'trust_backoff') return 429;
  if (code === 'cancelled') return 499;
  if (code === 'timeout') return 504;
  if (code === 'capability_unavailable') return 503;
  return 502;
}

function typeForCode(code: NodexErrorCode): string {
  if (code === 'auth') return 'authentication_error';
  if (code === 'forbidden') return 'permission_error';
  if (code === 'rate_limit' || code === 'trust_backoff') return 'rate_limit_error';
  if (
    code === 'invalid_request' ||
    code === 'not_found' ||
    code === 'conflict' ||
    code === 'payload_too_large'
  ) return 'invalid_request_error';
  return 'server_error';
}

function publicMessage(code: NodexErrorCode, source: string): string {
  if (code === 'upstream_protocol') return 'Upstream protocol failure';
  if (code === 'network') return 'Upstream network error';
  if (code === 'timeout') return 'Upstream request timed out';
  if (code === 'cancelled') return 'Request cancelled';
  if (code === 'rate_limit' || code === 'trust_backoff') return 'Upstream rate limit; retry later';
  return sanitizeMessage(source);
}

export function normalizeApiError(error: unknown, requestId?: string): ApiErrorMapping {
  let code: NodexErrorCode = 'upstream_protocol';
  let message = 'Internal server error';
  let retryAfterMs: number | undefined;
  let errorName = 'UnknownError';

  if (error instanceof ZodError) {
    code = 'invalid_request';
    message = error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ');
    errorName = error.name;
  } else if (error instanceof NodexError) {
    code = error.code;
    message = error.message;
    retryAfterMs = error.retryAfterMs;
    errorName = error.name;
  } else if (error instanceof ImageProviderError || error instanceof EmbeddingProviderError) {
    code = providerCode(error);
    message = error.status && code === 'invalid_request'
      ? 'Provider rejected the request parameters'
      : error.message;
    retryAfterMs = error.retryAfterMs;
    errorName = error.name;
  } else if (error && typeof error === 'object') {
    const fastify = error as { code?: unknown; name?: unknown };
    errorName = typeof fastify.name === 'string' ? fastify.name : errorName;
    if (fastify.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      code = 'payload_too_large';
      message = 'JSON body exceeds configured byte limit';
    }
  }

  const status = statusForCode(code);
  const errorObject: OpenAIErrorObject = {
    message: publicMessage(code, message),
    type: typeForCode(code),
    param: null,
    code,
    ...(requestId ? { request_id: requestId } : {}),
  };
  return {
    status,
    error: errorObject,
    ...(retryAfterMs === undefined || !Number.isFinite(retryAfterMs)
      ? {}
      : { retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1_000)) }),
    log: {
      ...(requestId ? { requestId } : {}),
      code,
      status,
      errorName,
    },
  };
}

export function apiErrorBody(error: unknown, requestId?: string): { error: OpenAIErrorObject } {
  return { error: normalizeApiError(error, requestId).error };
}

export function sendApiError(
  reply: FastifyReply,
  error: unknown,
  requestId?: string,
): FastifyReply {
  const mapped = normalizeApiError(error, requestId);
  if (mapped.retryAfterSeconds !== undefined) {
    reply.header('retry-after', mapped.retryAfterSeconds);
  }
  return reply.code(mapped.status).send({ error: mapped.error });
}
