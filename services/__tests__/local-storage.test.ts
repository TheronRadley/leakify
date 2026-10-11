/**
 * Local storage behaviour: versioned round-trips, and the recovery rules that
 * keep an unreadable value from becoming a destroyed value.
 */
import {
  discardQuarantined,
  getStorageIssues,
  hasStorageIssues,
  readJSON,
  readValue,
  resetStorageIssueRegistry,
  restoreQuarantined,
  storageKeys,
  writeJSON,
} from '@/services/local-storage';
import { STORAGE_SCHEMA_VERSION } from '@/services/storage-schema';

const mockMemory = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => mockMemory.get(key) ?? null,
  setItem: async (key: string, value: string) => void mockMemory.set(key, value),
  removeItem: async (key: string) => void mockMemory.delete(key),
  getAllKeys: async () => [...mockMemory.keys()],
  multiRemove: async (keys: string[]) => keys.forEach((k) => mockMemory.delete(k)),
}));

const KEY = storageKeys.subscriptions('local-user');

beforeEach(() => {
  mockMemory.clear();
  resetStorageIssueRegistry();
});

describe('writeJSON / readJSON', () => {
  it('persists inside a versioned envelope', async () => {
    await writeJSON(KEY, [{ id: 'a' }]);
    const raw = mockMemory.get(KEY) ?? '';
    expect(JSON.parse(raw).v).toBe(STORAGE_SCHEMA_VERSION);
    expect(JSON.parse(raw).data).toEqual([{ id: 'a' }]);
  });

  it('reads back what it wrote', async () => {
    const stored = [
      {
        id: 'sub-1',
        userId: 'local-user',
        name: 'Netflix',
        provider: null,
        category: 'streaming',
        amountCents: 1549,
        currency: 'USD',
        interval: { every: 1, unit: 'month' },
        startDate: '2026-01-01',
        nextBillingDate: '2026-02-01',
        trialEndDate: null,
        status: 'active',
        priceHistory: [],
      },
    ];
    await writeJSON(KEY, stored);
    expect(await readJSON(KEY, [], 'subscriptions')).toEqual(stored);
  });

  it('a rejected shape is reported, not silently returned as data', async () => {
    await writeJSON(KEY, [{ id: 'a' }]); // envelopes fine, payload is not a subscription
    expect(await readJSON(KEY, [], 'subscriptions')).toEqual([]);
    expect(getStorageIssues().map((i) => i.key)).toContain(KEY);
  });

  it('keeps the fallback semantics for a genuinely absent key', async () => {
    expect(await readJSON(KEY, [], 'subscriptions')).toEqual([]);
    expect(hasStorageIssues()).toBe(false);
    const outcome = await readValue(KEY, 'subscriptions');
    expect(outcome.status).toBe('absent');
  });
});

describe('recovery for unreadable values', () => {
  it('quarantines corrupt bytes instead of reporting an empty account', async () => {
    const broken = '[{"id": "sub-1", "name": "Netflix"'; // truncated write
    mockMemory.set(KEY, broken);

    const value = await readJSON(KEY, [], 'subscriptions');
    expect(value).toEqual([]); // the app stays usable…
    expect(hasStorageIssues()).toBe(true); // …but the incident is recorded, not hidden

    const [issue] = getStorageIssues();
    expect(issue.key).toBe(KEY);
    expect(issue.status).toBe('invalid');
    expect(issue.bytes).toBe(broken.length);
    // The raw bytes are preserved verbatim so a later build can recover them.
    expect(JSON.parse(mockMemory.get(storageKeys.recovery) ?? '[]')[0].raw).toBe(broken);
  });

  it('quarantines a newer-version payload and leaves the key untouched', async () => {
    const future = JSON.stringify({ v: STORAGE_SCHEMA_VERSION + 3, data: [{ id: 'x' }] });
    mockMemory.set(KEY, future);

    await expect(readJSON(KEY, [], 'subscriptions')).resolves.toEqual([]);
    expect(getStorageIssues()[0]?.status).toBe('unsupported_version');
    // The value on disk is still the future payload: a downgrade must not eat it.
    expect(mockMemory.get(KEY)).toBe(future);
  });

  it('refuses to restore something still unreadable, and does not touch the key', async () => {
    mockMemory.set(KEY, 'not json at all');
    await readValue(KEY, 'subscriptions');

    await expect(restoreQuarantined(KEY)).resolves.toBe(false);
    expect(mockMemory.get(KEY)).toBe('not json at all');
  });

  it('restores a parked value once it is understood, and clears the issue', async () => {
    // A payload this build's validator rejects (missing field) but that a newer
    // build accepts: the parked bytes are put back and the key is rewritten in
    // the current envelope format.
    mockMemory.set(
      storageKeys.notificationSettings('local-user'),
      JSON.stringify({ v: 1, data: { renewalLeadDays: [3], trialLeadDays: [1] } }),
    );
    const settingsKey = storageKeys.notificationSettings('local-user');
    await readValue(settingsKey, 'notificationSettings');
    expect(getStorageIssues().map((i) => i.key)).toContain(settingsKey);

    const restored = await restoreQuarantined(settingsKey, 'unknown');
    expect(restored).toBe(true);
    expect(hasStorageIssues()).toBe(false);
    expect(JSON.parse(mockMemory.get(settingsKey) ?? '{}').v).toBe(STORAGE_SCHEMA_VERSION);
  });

  it('drops the entry when the user discards it', async () => {
    mockMemory.set(KEY, '{oops');
    await readValue(KEY, 'subscriptions');
    expect(getStorageIssues()).toHaveLength(1);

    await discardQuarantined(KEY);
    expect(hasStorageIssues()).toBe(false);
    expect(mockMemory.has(storageKeys.recovery)).toBe(false);
  });

  it('clears the recorded issue once a healthy read happens again', async () => {
    mockMemory.set(KEY, '{oops');
    await readValue(KEY, 'subscriptions');
    expect(hasStorageIssues()).toBe(true);

    mockMemory.set(KEY, JSON.stringify({ v: 1, data: [] }));
    await readValue(KEY, 'subscriptions');
    expect(hasStorageIssues()).toBe(false);
  });

  it('bounds the recovery store so a persistent failure cannot grow without limit', async () => {
    for (let i = 0; i < 40; i += 1) {
      mockMemory.set(storageKeys.billingEvents(`scope-${i}`), '{broken');
      await readValue(storageKeys.billingEvents(`scope-${i}`), 'billingEvents');
    }
    const entries = JSON.parse(mockMemory.get(storageKeys.recovery) ?? '[]');
    expect(entries.length).toBeLessThanOrEqual(12);
  });
});
