import { MAX_CHUNK_LENGTH, createChunkedStorage } from '@/services/secure-store-adapter';

function makeBackend() {
  const store: Record<string, string> = {};
  const backend = {
    getItem: jest.fn(async (key: string) => store[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn(async (key: string) => {
      delete store[key];
    }),
  };
  return { backend, store };
}

const isChunk = (key: string) => key.includes('.__p') && key !== 'session.__parts';

describe('createChunkedStorage', () => {
  it('leaves a value that fits in the keystore in a single key', async () => {
    const { backend, store } = makeBackend();
    const storage = createChunkedStorage(backend);
    await storage.setItem('session', 'short');
    expect(Object.keys(store)).toEqual(['session']);
    await expect(storage.getItem('session')).resolves.toBe('short');
  });

  it('splits, stores and reassembles a value larger than the keystore limit', async () => {
    const { backend, store } = makeBackend();
    const storage = createChunkedStorage(backend);
    const session = JSON.stringify({ access_token: 'a'.repeat(9000), user: { email: 'me@example.com' } });
    await storage.setItem('session', session);

    expect(session.length).toBeGreaterThan(MAX_CHUNK_LENGTH);
    expect(store['session']).toBeUndefined(); // never a stale second copy
    expect(Object.keys(store).filter(isChunk).length).toBeGreaterThanOrEqual(5);
    expect(store['session.__parts']).toBe(String(Object.keys(store).filter(isChunk).length));
    await expect(storage.getItem('session')).resolves.toBe(session);
  });

  it('keeps every chunk within the platform limit', async () => {
    const { backend } = makeBackend();
    const storage = createChunkedStorage(backend);
    await storage.setItem('session', 'b'.repeat(12000));
    const writes = backend.setItem.mock.calls;
    for (const [, value] of writes) expect((value as string).length).toBeLessThanOrEqual(MAX_CHUNK_LENGTH);
  });

  it('clears every chunk on remove so sign-out leaves nothing behind', async () => {
    const { backend, store } = makeBackend();
    const storage = createChunkedStorage(backend);
    await storage.setItem('session', 'x'.repeat(5000));
    expect(Object.keys(store).length).toBeGreaterThan(1);
    await storage.removeItem('session');
    expect(store).toEqual({});
  });

  it('shrinks cleanly when a long value is replaced by a short one', async () => {
    const { backend, store } = makeBackend();
    const storage = createChunkedStorage(backend);
    await storage.setItem('session', 'y'.repeat(9000));
    await storage.setItem('session', 'tiny');
    expect(Object.keys(store).filter(isChunk)).toEqual([]);
    expect(store['session.__parts']).toBeUndefined();
    await expect(storage.getItem('session')).resolves.toBe('tiny');
  });

  it('falls back instead of returning a truncated session when a chunk is lost', async () => {
    const { backend, store } = makeBackend();
    const storage = createChunkedStorage(backend);
    await storage.setItem('session', 'z'.repeat(5000));
    delete store[Object.keys(store).find(isChunk)!]; // keystore dropped one piece
    await expect(storage.getItem('session')).resolves.toBeNull();
  });

  it('reads a pre-chunking value written by an older build', async () => {
    const { backend, store } = makeBackend();
    store['session'] = 'legacy-single-value';
    const storage = createChunkedStorage(backend);
    await expect(storage.getItem('session')).resolves.toBe('legacy-single-value');
  });

  it('ignores an impossible chunk count instead of looping over it', async () => {
    const { backend, store } = makeBackend();
    store['session'] = 'still-usable';
    store['session.__parts'] = '999999';
    const storage = createChunkedStorage(backend);
    await expect(storage.getItem('session')).resolves.toBe('still-usable');
    expect(backend.getItem).toHaveBeenCalledTimes(2); // the count, then the value
  });

  it('treats a read failure as "no stored session" rather than an error', async () => {
    const storage = createChunkedStorage({
      getItem: jest.fn(async () => {
        throw new Error('keystore locked');
      }),
      setItem: jest.fn(async () => undefined),
      removeItem: jest.fn(async () => undefined),
    });
    await expect(storage.getItem('session')).resolves.toBeNull();
  });

  it('never rejects a sign-out because the keystore refused a delete', async () => {
    const storage = createChunkedStorage({
      getItem: jest.fn(async () => null),
      setItem: jest.fn(async () => undefined),
      removeItem: jest.fn(async () => {
        throw new Error('delete failed');
      }),
    });
    await expect(storage.removeItem('session')).resolves.toBeUndefined();
  });

  it('refuses to pretend a value too large for the keystore was saved', async () => {
    const { backend } = makeBackend();
    const storage = createChunkedStorage(backend);
    await expect(storage.setItem('session', 'c'.repeat(MAX_CHUNK_LENGTH * 40))).rejects.toThrow(/does not fit/);
  });
});
