/**
 * Payment recording must be atomic (cloud, via `record_payment`) or replay-safe
 * (local, via the expected-date guard). A half-applied payment — history written
 * but schedule not rolled, or the reverse — is the failure these tests pin.
 */
import { LocalBillingEventRepository, LocalSubscriptionRepository } from '@/services/local-repository';
import { SupabaseSubscriptionRepository } from '@/services/supabase-repository';
import { readJSON, storageKeys, writeJSON } from '@/services/local-storage';
import { RepositoryError, type SubscriptionInput } from '@/services/repository';
import type { BillingEvent } from '@/types';

const mockMemory = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => mockMemory.get(key) ?? null,
  setItem: async (key: string, value: string) => void mockMemory.set(key, value),
  removeItem: async (key: string) => void mockMemory.delete(key),
  getAllKeys: async () => [...mockMemory.keys()],
  multiRemove: async (keys: string[]) => keys.forEach((k) => mockMemory.delete(k)),
}));

beforeEach(() => mockMemory.clear());

function input(overrides: Partial<SubscriptionInput> = {}): SubscriptionInput {
  return {
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
    paymentMethodLabel: null,
    cancellationUrl: null,
    cancellationNotes: null,
    notes: null,
    reminders: { enabled: true, renewalLeadDays: [3, 1, 0], trialLeadDays: [1] },
    flaggedUnused: false,
    isCancelCandidate: false,
    ...overrides,
  };
}

describe('local recordPayment — replay safety', () => {
  it('writes the event and rolls the schedule forward', async () => {
    const repo = new LocalSubscriptionRepository('local-user');
    const created = await repo.create(input());
    const updated = await repo.recordPayment(created.id, '2026-02-01', 1549);

    expect(updated.nextBillingDate).toBe('2026-03-01');
    const events = await new LocalBillingEventRepository('local-user').listForSubscription(created.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ expectedDate: '2026-02-01', amountCents: 1549, status: 'charged' });
  });

  it('does not duplicate the charge when the schedule roll is retried', async () => {
    const repo = new LocalSubscriptionRepository('local-user');
    const created = await repo.create(input());
    const key = storageKeys.billingEvents('local-user');

    // Simulate the crash window: the event landed, the subscription did not move.
    const orphan: BillingEvent = {
      id: 'evt-1',
      subscriptionId: created.id,
      userId: 'local-user',
      expectedDate: '2026-02-01',
      amountCents: 1549,
      currency: 'USD',
      type: 'renewal',
      status: 'charged',
      actualDate: '2026-02-01',
      actualAmountCents: 1549,
      createdAt: '2026-02-01T00:00:00.000Z',
    };
    await writeJSON(key, [orphan]);

    const updated = await repo.recordPayment(created.id, '2026-02-01', 1549);
    const events = await readJSON<BillingEvent[]>(key, [], 'billingEvents');

    expect(events).toHaveLength(1); // no second copy of the same charge
    expect(updated.nextBillingDate).toBe('2026-03-01'); // and the schedule did move
  });

  it('flips a trial to active as part of recording the first charge', async () => {
    const repo = new LocalSubscriptionRepository('local-user');
    const created = await repo.create(
      input({ status: 'trialing', trialEndDate: '2026-02-01', nextBillingDate: '2026-02-01' }),
    );
    const updated = await repo.recordPayment(created.id, '2026-02-01', 1549);
    expect(updated.status).toBe('active');
    const events = await new LocalBillingEventRepository('local-user').listForSubscription(created.id);
    expect(events[0]?.type).toBe('trial_end');
  });

  it('refuses to record without a schedule to roll forward', async () => {
    const repo = new LocalSubscriptionRepository('local-user');
    const created = await repo.create(input({ nextBillingDate: null }));
    await expect(repo.recordPayment(created.id, '2026-02-01', 1549)).rejects.toBeInstanceOf(RepositoryError);
  });
});

/** Fake Supabase client covering rpc()/from() chains used by recordPayment. */
function fakeRpc(options: {
  rpcResult?: { data: unknown; error: { message: string; code?: string } | null };
  /** Row as stored *before* the call (what `get()` reads). */
  beforeRow?: Record<string, unknown>;
  /** Row the RPC returns after rolling the schedule forward. */
  afterRow?: Record<string, unknown>;
} = {}) {
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const baseRow = {
    id: 'sub-1',
    user_id: 'user-1',
    name: 'Netflix',
    provider: null,
    category: 'streaming',
    amount_cents: 1549,
    currency: 'USD',
    interval_every: 1,
    interval_unit: 'month',
    start_date: '2026-01-01',
    next_billing_date: '2026-02-01',
    trial_end_date: null,
    status: 'active',
    payment_method_label: null,
    cancellation_url: null,
    cancellation_notes: null,
    notes: null,
    reminders: { enabled: true, renewalLeadDays: [3], trialLeadDays: [1] },
    flagged_unused: false,
    is_cancel_candidate: false,
    canceled_at: null,
    archived_at: null,
    price_history: [],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
  };
  const before = options.beforeRow ?? baseRow;
  const after = options.afterRow ?? { ...baseRow, next_billing_date: '2026-03-01' };

  const selectBuilder = {
    eq() {
      return selectBuilder;
    },
    maybeSingle() {
      return Promise.resolve({ data: before, error: null });
    },
  };

  return {
    rpcCalls,
    from() {
      return { select: () => selectBuilder };
    },
    rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      return Promise.resolve(options.rpcResult ?? { data: after, error: null });
    },
  };
}

describe('supabase recordPayment — one atomic RPC', () => {
  it('calls record_payment with the computed next date and a retry key', async () => {
    const db = fakeRpc({});
    const repo = new SupabaseSubscriptionRepository(db as never, 'user-1');
    const updated = await repo.recordPayment('sub-1', '2026-02-01', 1549);

    expect(db.rpcCalls).toHaveLength(1);
    const { fn, args } = db.rpcCalls[0];
    expect(fn).toBe('record_payment');
    expect(args.p_subscription_id).toBe('sub-1');
    expect(args.p_actual_date).toBe('2026-02-01');
    expect(args.p_actual_amount_cents).toBe(1549);
    expect(args.p_next_billing_date).toBe('2026-03-01');
    expect(String(args.p_client_request_id)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(updated.nextBillingDate).toBe('2026-03-01');
  });

  it('maps the RPC refusals to user-safe validation errors', async () => {
    const db = fakeRpc({ rpcResult: { data: null, error: { message: 'leakify:invalid_next_billing_date' } } });
    const repo = new SupabaseSubscriptionRepository(db as never, 'user-1');
    await expect(repo.recordPayment('sub-1', '2026-02-01', 1549)).rejects.toMatchObject({
      code: 'validation',
    });
  });

  it('says so when the project has not been migrated', async () => {
    const db = fakeRpc({
      rpcResult: { data: null, error: { message: 'Could not find the record_payment function', code: 'PGRST202' } },
    });
    const repo = new SupabaseSubscriptionRepository(db as never, 'user-1');
    await expect(repo.recordPayment('sub-1', '2026-02-01', 1549)).rejects.toMatchObject({
      message: expect.stringContaining('missing a database migration'),
    });
  });
});
