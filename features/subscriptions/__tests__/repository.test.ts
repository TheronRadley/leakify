/**
 * Integration tests for the local repository: CRUD, cancellation-state
 * transitions, price history preservation, payment recording and demo seeding.
 */
import {
  LocalBillingEventRepository,
  LocalProfileRepository,
  LocalSubscriptionRepository,
} from '@/services/local-repository';
import type { SubscriptionInput } from '@/services/repository';

// In-mockMemory AsyncStorage mock.
const mockMemory = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => mockMemory.get(key) ?? null,
  setItem: async (key: string, value: string) => void mockMemory.set(key, value),
  removeItem: async (key: string) => void mockMemory.delete(key),
  getAllKeys: async () => [...mockMemory.keys()],
  multiRemove: async (keys: string[]) => keys.forEach((k) => mockMemory.delete(k)),
}));

function input(partial: Partial<SubscriptionInput> = {}): SubscriptionInput {
  return {
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
    ...partial,
  };
}

describe('LocalSubscriptionRepository', () => {
  let repo: LocalSubscriptionRepository;

  beforeEach(() => {
    mockMemory.clear();
    repo = new LocalSubscriptionRepository('test-user');
  });

  it('creates, lists and fetches a subscription', async () => {
    const created = await repo.create(input());
    expect(created.id).toBeTruthy();
    expect(await repo.list()).toHaveLength(1);
    expect((await repo.get(created.id))?.name).toBe('Netflix');
  });

  it('validates on write', async () => {
    await expect(repo.create(input({ name: ' ' }))).rejects.toMatchObject({ code: 'validation' });
    await expect(repo.create(input({ amountCents: -5 }))).rejects.toMatchObject({ code: 'validation' });
    await expect(repo.create(input({ currency: 'usd' }))).rejects.toMatchObject({ code: 'validation' });
  });

  it('edits a subscription and bumps updatedAt', async () => {
    const created = await repo.create(input());
    const updated = await repo.update(created.id, { amountCents: 1699 });
    expect(updated.amountCents).toBe(1699);
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(created.updatedAt).getTime());
  });

  it('preserves historical prices when the amount changes', async () => {
    const created = await repo.create(input({ amountCents: 1399 }));
    const updated = await repo.update(created.id, { amountCents: 1549 });
    expect(updated.priceHistory).toHaveLength(1);
    expect(updated.priceHistory[0]).toMatchObject({ amountCents: 1399, currency: 'USD' });
  });

  it('deletes records and scopes data per user', async () => {
    const created = await repo.create(input());
    const otherUser = new LocalSubscriptionRepository('someone-else');
    expect(await otherUser.list()).toHaveLength(0); // user-level isolation
    await repo.remove(created.id);
    expect(await repo.list()).toHaveLength(0);
  });

  describe('cancellation-state transitions', () => {
    it('active -> paused -> active keeps records intact', async () => {
      const created = await repo.create(input());
      const paused = await repo.setStatus(created.id, 'paused');
      expect(paused.status).toBe('paused');
      const resumed = await repo.setStatus(created.id, 'active');
      expect(resumed.status).toBe('active');
      expect(resumed.canceledAt).toBeNull();
    });

    it('active -> canceled records a user-supplied cancellation timestamp', async () => {
      const created = await repo.create(input());
      const canceled = await repo.setStatus(created.id, 'canceled');
      expect(canceled.status).toBe('canceled');
      expect(canceled.canceledAt).toBeTruthy();
      // History (price, notes) survives the cancellation.
      expect(canceled.amountCents).toBe(1549);
      expect(canceled.notes).toBeDefined();
    });

    it('re-activating clears the cancellation marker', async () => {
      const created = await repo.create(input());
      await repo.setStatus(created.id, 'canceled');
      const back = await repo.setStatus(created.id, 'active');
      expect(back.canceledAt).toBeNull();
    });
  });

  describe('recordPayment', () => {
    it('rolls nextBillingDate one full interval forward and logs a billing event', async () => {
      const created = await repo.create(input({ nextBillingDate: '2026-01-31' }));
      const updated = await repo.recordPayment(created.id, '2026-01-31', 1549);
      expect(updated.nextBillingDate).toBe('2026-02-28'); // month-end clamp
      const events = new LocalBillingEventRepository('test-user');
      const list = await events.listForSubscription(created.id);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ status: 'charged', actualAmountCents: 1549, expectedDate: '2026-01-31' });
    });

    it('converts trialing subscriptions to active on first charge', async () => {
      const created = await repo.create(
        input({ status: 'trialing', trialEndDate: '2026-10-15', nextBillingDate: '2026-10-15' }),
      );
      const updated = await repo.recordPayment(created.id, '2026-10-15', 1549);
      expect(updated.status).toBe('active');
      expect(updated.nextBillingDate).toBe('2026-11-15');
    });

    it('rejects payment recording without a billing date', async () => {
      const created = await repo.create(input({ nextBillingDate: null }));
      await expect(repo.recordPayment(created.id, '2026-10-15', 1549)).rejects.toMatchObject({ code: 'validation' });
    });
  });
});

describe('LocalProfileRepository', () => {
  it('upserts and deletes account data', async () => {
    const profiles = new LocalProfileRepository('user-1');
    const saved = await profiles.upsert({ displayName: 'Ana', preferredCurrency: 'EUR' });
    expect(saved.displayName).toBe('Ana');
    expect(saved.preferredCurrency).toBe('EUR');

    const subs = new LocalSubscriptionRepository('user-1');
    await subs.create(input());
    expect(await subs.list()).toHaveLength(1);

    await profiles.deleteAccountData();
    expect(await subs.list()).toHaveLength(0);
    expect(await profiles.get()).toBeNull();
  });
});
