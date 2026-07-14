export type NodexErrorCode =
  | 'auth'
  | 'forbidden'
  | 'thread_not_found'
  | 'rate_limit'
  | 'trust_backoff'
  | 'timeout'
  | 'cancelled'
  | 'network'
  | 'upstream_protocol'
  | 'invalid_request'
  | 'not_found'
  | 'conflict'
  | 'payload_too_large'
  | 'capability_unavailable';

export class NodexError extends Error {
  constructor(public readonly code: NodexErrorCode, message: string, public readonly retryAfterMs?: number) {
    super(message);
    this.name = 'NodexError';
  }
}

export function redactSecrets(value: string, secrets: Array<string | undefined>): string {
  let redacted = value;
  for (const secret of secrets) if (secret) redacted = redacted.split(secret).join('[REDACTED]');
  return redacted;
}

export function parseRetryAfter(value: string | null, fallbackMs = 1_000): number {
  if (!value) return fallbackMs;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1_000, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(1_000, date - Date.now()) : fallbackMs;
}
