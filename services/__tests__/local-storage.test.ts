/**
 * Local storage lifecycle (audit R-01): a payload that cannot be read must be
 * reported, not replaced with an empty default, and data from a newer build
 * must be refused rather than half-read.
 */
import { LocalSubscriptionRepository } from '@/services/local-repository';
import {
  CURRENT_SCHEMA_VERSION,
  getStoredSchemaVersion,
  migrateLocalStorage,
  readJSON,
  readStored,
  readStoredOrNull,
  StorageCorruptionError,
  StorageVersionError,
  storageKeys,
} from '@/services/local-storage';
import { toUserMessage } from '@/services/repository';
import type { SubscriptionInput } from '@/services/repository';

const mockMemory = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => mockMemory.get(key) ?? null,
  setItem: async (key: string, value: string) => void mockMemory.set(key, value),
  removeItem: async (key: string) => void mockMemory.delete(key),
  getAllKeys: async () => [...mockMemory.keys()],
  multiRemove: async (keys: string[]) => keys.forEach((k) => mockMemory.delete(k)),
}));

beforeEach(() => {
  mockMemory.clear();
});

function validSubscription(id = 's1') {
  return {
    id,
    userId: 'local-user',
    name: 'Netflix',
    provider: null,
    category: 'streaming',
    amountCents: 1549,
    currency: 'USD',
    interval: { every: 1, unit: 'month' },
    startDate: '2026-01-01',
    nextBillingDate: '2026-10-15',
    trialEndDate: null,
    status: 'active',
    paymentMethodLabel: null,
    cancellationUrl: null,
    cancellationNotes: null,
    notes: null,
    reminders: { enabled: true, renewalLeadDays: [3, 1], trialLeadDays: [] },
    flaggedUnused: false,
    isCancelCandidate: false,
    canceledAt: null,
    archivedAt: null,
    priceHistory: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('readStored', () => {
  const key = storageKeys.subscriptions('local-user');

  it('returns the fallback when the key does not exist yet', async () => {
    await expect(readStored('subscriptions', key, [])).resolves.toEqual([]);
    await expect(readStoredOrNull('profile', storageKeys.profile('local-user'))).resolves.toBeNull();
  });

  it('accepts a valid payload', async () => {
    mockMemory.set(key, JSON.stringify([validSubscription()]));
    const subs = await readStored('subscriptions', key, []);
    expect(subs).toHaveLength(1);
    expect(subs[0].name).toBe('Netflix');
  });

  it('throws on unparseable JSON instead of returning []', async () => {
    mockMemory.set(key, '{"truncated": ');
    await expect(readStored('subscriptions', key, [])).rejects.toBeInstanceOf(StorageCorruptionError);
  });

  it('throws on a payload with the wrong shape', async () => {
    mockMemory.set(key, JSON.stringify({ not: 'an array' }));
    await expect(readStored('subscriptions', key, [])).rejects.toThrow(/unexpected shape/);
  });

  it('throws when a required field is missing or of the wrong type', async () => {
    const { amountCents: _dropped, ...noAmount } = validSubscription();
    mockMemory.set(key, JSON.stringify([noAmount]));
    await expect(readStored('subscriptions', key, [])).rejects.toBeInstanceOf(StorageCorruptionError);

    mockMemory.set(key, JSON.stringify([{ ...validSubscription(), amountCents: '1549' }]));
    await expect(readStored('subscriptions', key, [])).rejects.toBeInstanceOf(StorageCorruptionError);
  });

  it('names the offending key and path so the message is actionable', async () => {
    mockMemory.set(key, JSON.stringify([{ ...validSubscription(), amountCents: 'nope' }]));
    await expect(readStored('subscriptions', key, [])).rejects.toThrow(
      new RegExp(`${key.replace(/\./g, '\\.')}.*amountCents`),
    );
  });

  it('still reads JSON scalars, and still throws when they are corrupt', async () => {
    mockMemory.set(storageKeys.dataMode, JSON.stringify('local'));
    await expect(readJSON(storageKeys.dataMode, null)).resolves.toBe('local');

    mockMemory.set(storageKeys.dataMode, 'not json');
    await expect(readJSON(storageKeys.dataMode, null)).rejects.toBeInstanceOf(StorageCorruptionError);
  });
});

describe('schema versions', () => {
  it('fills in fields an older build did not write (v1 → v2)', async () => {
    // A 1.0.0 payload: no genericLockScreenText, no permissionStatus.
    mockMemory.set(
      storageKeys.notificationSettings('local-user'),
      JSON.stringify({ renewalLeadDays: [3, 1, 0], trialLeadDays: [1], weeklyDigestEnabled: false }),
    );

    const settings = await readStoredOrNull('notificationSettings', storageKeys.notificationSettings('local-user'));

    expect(settings).toMatchObject({
      weeklyDigestEnabled: false,
      genericLockScreenText: false,
      permissionStatus: 'unknown',
    });
  });

  it('records the current version on first run and is idempotent after', async () => {
    expect(await getStoredSchemaVersion()).toBe(1);

    await expect(migrateLocalStorage()).resolves.toBe(CURRENT_SCHEMA_VERSION);
    expect(await getStoredSchemaVersion()).toBe(CURRENT_SCHEMA_VERSION);

    // Second run must not re-run migrations or throw.
    await expect(migrateLocalStorage()).resolves.toBe(CURRENT_SCHEMA_VERSION);
  });

  it('refuses data written by a newer build instead of half-reading it', async () => {
    mockMemory.set(storageKeys.schemaVersion, JSON.stringify(CURRENT_SCHEMA_VERSION + 1));

    await expect(migrateLocalStorage()).rejects.toBeInstanceOf(StorageVersionError);
    await expect(migrateLocalStorage()).rejects.toThrow(/newer version of Leakify/);
  });

  it('refuses a version key that is not a version', async () => {
    mockMemory.set(storageKeys.schemaVersion, JSON.stringify('two'));
    await expect(migrateLocalStorage()).rejects.toBeInstanceOf(StorageCorruptionError);
  });
});

describe('surfacing corruption to the user', () => {
  it('propagates out of the repository instead of returning an empty list', async () => {
    mockMemory.set(storageKeys.subscriptions('local-user'), 'not json at all');
    const repo = new LocalSubscriptionRepository('local-user');

    await expect(repo.list()).rejects.toBeInstanceOf(StorageCorruptionError);
  });

  it('keeps a user-readable message all the way to the UI', async () => {
    mockMemory.set(storageKeys.subscriptions('local-user'), '{}');
    const repo = new LocalSubscriptionRepository('local-user');

    const message = await repo.list().then(
      () => 'no error',
      (err: unknown) => toUserMessage(err),
    );

    expect(message).not.toBe('Something went wrong. Please try again.');
    expect(message).toContain('could not be read');
  });

  it('tells the user nothing was deleted', async () => {
    mockMemory.set(storageKeys.subscriptions('local-user'), 'broken');
    await expect(
      new LocalSubscriptionRepository('local-user').list(),
    ).rejects.toThrow(/Nothing was deleted/);
  });
});

describe('writing valid data still works', () => {
  it('round-trips a subscription through create + list', async () => {
    const repo = new LocalSubscriptionRepository('local-user');
    const input: SubscriptionInput = {
      name: 'Spotify',
      provider: null,
      category: 'music',
      amountCents: 1099,
      currency: 'USD',
      interval: { every: 1, unit: 'month' },
      startDate: '2026-01-01',
      nextBillingDate: '2026-11-01',
      trialEndDate: null,
      status: 'active',
      paymentMethodLabel: null,
      cancellationUrl: null,
      cancellationNotes: null,
      notes: null,
      reminders: { enabled: true, renewalLeadDays: [3], trialLeadDays: [] },
      flaggedUnused: false,
      isCancelCandidate: false,
    };

    await repo.create(input);

    const subs = await repo.list();
    expect(subs).toHaveLength(1);
    expect(subs[0].name).toBe('Spotify');
  });

  it('rejects an http:// cancellation link at the repository boundary too', async () => {
    const repo = new LocalSubscriptionRepository('local-user');

    await expect(
      repo.create({
        name: 'Old provider',
        provider: null,
        category: 'other',
        amountCents: 500,
        currency: 'USD',
        interval: { every: 1, unit: 'month' },
        startDate: null,
        nextBillingDate: '2026-11-01',
        trialEndDate: null,
        status: 'active',
        paymentMethodLabel: null,
        cancellationUrl: 'http://example.com/cancel',
        cancellationNotes: null,
        notes: null,
        reminders: { enabled: true, renewalLeadDays: [3], trialLeadDays: [] },
        flaggedUnused: false,
        isCancelCandidate: false,
      }),
    ).rejects.toMatchObject({ code: 'validation' });
  });
});
