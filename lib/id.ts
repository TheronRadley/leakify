/**
 * Identifier generation for client-side writes.
 *
 * Two consumers: local records, and idempotency keys handed to the database
 * (`billing_events.client_request_id`), which is a `uuid` column and therefore
 * needs UUID-shaped values.
 *
 * These ids are *not* a security primitive — no unpredictability guarantee is
 * made or needed here (React Native has no WebCrypto on every engine, and an
 * idempotency key only has to be unique per request). If a real RNG becomes a
 * requirement, switch to `expo-crypto`'s `randomUUID` rather than `Math.random`.
 */

const HEX = '0123456789abcdef';

/** RFC 4122-shaped v4 string (version/variant nibbles set correctly). */
export function uuidV4(): string {
  let out = '';
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += '-';
      continue;
    }
    if (i === 14) {
      out += '4'; // version 4
      continue;
    }
    if (i === 19) {
      out += HEX[(Math.floor(Math.random() * 16) & 0x3) | 0x8]; // variant 10xx
      continue;
    }
    out += HEX[Math.floor(Math.random() * 16)];
  }
  return out;
}

/**
 * Idempotency key for one user action. Callers create it *before* the first
 * attempt and reuse it across retries, which is what makes a retry safe instead
 * of double-recording a charge.
 */
export function createRequestId(): string {
  return uuidV4();
}
