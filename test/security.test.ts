import { expect, it } from 'vitest';
import { NodexError, redactSecrets } from '../src/errors.js';
import { truncateUtf8 } from '../src/core.js';
import { normalizeApiError } from '../src/http/errors.js';

it('redacts every secret occurrence', () => expect(redactSecrets('x TOKEN y TOKEN z', ['TOKEN'])).toBe('x [REDACTED] y [REDACTED] z'));
it('truncates multibyte output on UTF-8 boundary', () => {
  const result = truncateUtf8('абвгд', 5); expect(result).not.toContain('�'); expect(result).toContain('truncated');
});

it('redacts provider-like secrets and preserves retry metadata in public errors', () => {
  const mapped = normalizeApiError(
    new NodexError(
      'rate_limit',
      `Bearer secret ${'A'.repeat(200)}`,
      2_100,
    ),
    'req_test',
  );
  expect(mapped.status).toBe(429);
  expect(mapped.retryAfterSeconds).toBe(3);
  expect(mapped.error.message).not.toContain('secret');
  expect(mapped.error.request_id).toBe('req_test');
});
