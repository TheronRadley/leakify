/**
 * Chunked session storage for React Native.
 *
 * Supabase's session JSON does not always fit in the ~2 KB value limit
 * `expo-secure-store` enforces; a truncated session means an app that silently
 * loses sign-in — or, worse for recovery, a PKCE code verifier that can no longer
 * be found, so the emailed link can never be exchanged. Values that do not fit are
 * therefore split across several keys and reassembled on read.
 *
 * The adapter implements the storage interface `@supabase/supabase-js` expects
 * (getItem/setItem/removeItem, all async) over an injected backend, so both the
 * split and the older single-value format are unit-testable without a keychain.
 */

/** Stay under the platform limit, with headroom for the key suffix. */
export const MAX_CHUNK_LENGTH = 1800;

/** Guard against an absurd stored count (corruption, or a hand-edited keystore). */
export const MAX_CHUNKS = 32;

export interface KeyValueBackend {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface TokenStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const countKey = (key: string) => `${key}.__parts`;
const chunkKey = (key: string, index: number) => `${key}.__p${index}`;

export function createChunkedStorage(backend: KeyValueBackend): TokenStorageAdapter {
  /** A keystore that throws on read must not look like "the user is corrupt". */
  async function readRaw(rawKey: string): Promise<string | null> {
    try {
      return await backend.getItem(rawKey);
    } catch {
      return null;
    }
  }

  async function readCount(key: string): Promise<number> {
    const raw = await readRaw(countKey(key));
    if (!raw) return 0;
    const count = Number.parseInt(raw, 10);
    return Number.isInteger(count) && count > 0 && count <= MAX_CHUNKS ? count : 0;
  }

  async function dropAux(key: string, count: number): Promise<void> {
    try {
      await backend.removeItem(countKey(key));
      for (let i = 0; i < Math.max(count, 1); i += 1) {
        await backend.removeItem(chunkKey(key, i));
      }
    } catch {
      // A leftover chunk is inert while the count is gone, and harmless to retry.
    }
  }

  return {
    async getItem(key: string): Promise<string | null> {
      const count = await readCount(key);
      if (count === 0) return readRaw(key); // un-chunked value (older builds, or a short one)

      const parts: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const part = await readRaw(chunkKey(key, i));
        // A missing chunk means a torn write. Returning the concatenation would
        // hand supabase-js a truncated session or verifier, which fails in ways
        // that look like "your link is invalid" — so fall back instead.
        if (part === null) return readRaw(key);
        parts.push(part);
      }
      return parts.join('');
    },

    async setItem(key: string, value: string): Promise<void> {
      const previousCount = await readCount(key);

      if (value.length <= MAX_CHUNK_LENGTH) {
        await backend.setItem(key, value);
        await dropAux(key, previousCount);
        return;
      }

      const chunks: string[] = [];
      for (let offset = 0; offset < value.length; offset += MAX_CHUNK_LENGTH) {
        chunks.push(value.slice(offset, offset + MAX_CHUNK_LENGTH));
      }
      if (chunks.length > MAX_CHUNKS) {
        throw new Error(
          `Value of ${value.length} characters does not fit in ${MAX_CHUNKS} chunks; refuse to store it partially.`,
        );
      }

      // Chunks first, count last: the count is the commit marker, so an interrupted
      // write leaves the previous value readable rather than pointing at chunks
      // that were never written.
      for (let i = 0; i < chunks.length; i += 1) {
        await backend.setItem(chunkKey(key, i), chunks[i]);
      }
      await backend.setItem(countKey(key), String(chunks.length));

      try {
        // Drop the un-chunked copy and any tail chunks from a longer previous
        // value, so exactly one representation is ever on disk.
        await backend.removeItem(key);
        for (let i = chunks.length; i < previousCount; i += 1) {
          await backend.removeItem(chunkKey(key, i));
        }
      } catch {
        // cleanup only
      }
    },

    async removeItem(key: string): Promise<void> {
      const count = await readCount(key);
      try {
        await backend.removeItem(key);
      } catch {
        // already gone
      }
      await dropAux(key, count);
    },
  };
}
