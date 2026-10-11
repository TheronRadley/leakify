/**
 * The URL policy must hold at the storage boundary, not just in the form. These
 * tests write directly through the repositories — the same path an import, a
 * future API client or an older build would use — and assert that an
 * unsafe/invalid link never lands in storage.
 */
import { LocalSubscriptionRepository } from '@/services/local-repository';
import { SupabaseProfileRepository, SupabaseSubscriptionRepository } from '@/services/supabase-repository';
import { RepositoryError } from '@/services/repository';
import type { SubscriptionInput } from '@/services/repository';

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

describe('local repository — cancellation link policy', () => {
  const repo = () => new LocalSubscriptionRepository('local-user');

  it('stores a normalized https link', async () => {
    const created = await repo().create(input({ cancellationUrl: ' HTTPS://Example.com/cancel ' }));
    expect(created.cancellationUrl).toBe('https://example.com/cancel');
    const reread = await repo().get(created.id);
    expect(reread?.cancellationUrl).toBe('https://example.com/cancel');
  });

  it.each(['javascript:alert(1)', 'file:///etc/passwd', 'intent://scan/#Intent', '//evil.example.com', 'http://example.com/cancel'])(
    'refuses to store %s',
    async (bad) => {
      await expect(repo().create(input({ cancellationUrl: bad }))).rejects.toBeInstanceOf(RepositoryError);
      await expect(repo().list()).resolves.toEqual([]);
    },
  );

  it('refuses an unsafe link on update without corrupting the stored row', async () => {
    const created = await repo().create(input({ cancellationUrl: 'https://example.com/cancel' }));
    await expect(repo().update(created.id, { cancellationUrl: 'javascript:alert(1)' })).rejects.toMatchObject({
      code: 'validation',
    });
    const reread = await repo().get(created.id);
    expect(reread?.cancellationUrl).toBe('https://example.com/cancel');
  });

  it('still allows clearing the link', async () => {
    const created = await repo().create(input({ cancellationUrl: 'https://example.com/cancel' }));
    const updated = await repo().update(created.id, { cancellationUrl: null });
    expect(updated.cancellationUrl).toBeNull();
  });

  it('rejects a control-character smuggled link that a regex would have allowed', async () => {
    await expect(repo().create(input({ cancellationUrl: 'https://exa\tmple.com/cancel' }))).rejects.toBeInstanceOf(
      RepositoryError,
    );
  });
});

/**
 * Minimal stand-in for the Supabase client. Records every operation the
 * repository attempts, and can fail selected tables so partial-failure handling
 * is observable. Only the surface the repository uses is implemented.
 */
interface RecordedCall {
  table: string;
  op: 'delete' | 'insert' | 'update' | 'select';
  filters: [string, string][];
  values?: Record<string, unknown>;
}

function fakeSupabase(options: { failOn?: string[]; row?: Record<string, unknown> | null } = {}) {
  const calls: RecordedCall[] = [];
  const failOn = options.failOn ?? [];

  function builder(entry: RecordedCall): Record<string, unknown> {
    const api: Record<string, unknown> = {
      eq(column: string, value: string) {
        entry.filters.push([column, value]);
        return api;
      },
      select() {
        return api;
      },
      maybeSingle() {
        return Promise.resolve({ data: null, error: null });
      },
      single() {
        return Promise.resolve({ data: options.row ?? null, error: null });
      },
      insert(values: Record<string, unknown>) {
        entry.op = 'insert';
        entry.values = values;
        calls.push(entry);
        return api;
      },
      update(values: Record<string, unknown>) {
        entry.op = 'update';
        entry.values = values;
        calls.push(entry);
        return api;
      },
      delete() {
        entry.op = 'delete';
        calls.push(entry);
        return api;
      },
      // supabase-js builders are thenable: `await` happens after the whole
      // `.delete().eq(...)` chain is built, so the result must be produced here.
      then(onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        const error =
          entry.op === 'delete' && failOn.includes(entry.table)
            ? { message: `permission denied for table ${entry.table}`, code: '42501' }
            : null;
        return Promise.resolve({ data: null, error }).then(onFulfilled, onRejected);
      },
    };
    return api;
  }

  return {
    calls,
    from(table: string) {
      return builder({ table, op: 'select', filters: [] });
    },
  } as { calls: RecordedCall[]; from: (table: string) => Record<string, unknown> };
}

function storedRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
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
    reminders: { enabled: true, renewalLeadDays: [3, 1, 0], trialLeadDays: [1] },
    flagged_unused: false,
    is_cancel_candidate: false,
    canceled_at: null,
    archived_at: null,
    price_history: [],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('supabase repository — write and delete semantics', () => {
  it('validates the link before sending an insert', async () => {
    const db = fakeSupabase();
    const repo = new SupabaseSubscriptionRepository(db as never, 'user-1');
    await expect(repo.create(input({ cancellationUrl: 'javascript:alert(1)' }))).rejects.toMatchObject({
      code: 'validation',
    });
    expect(db.calls).toEqual([]);
  });

  it('sends the normalized link, not the raw paste', async () => {
    const db = fakeSupabase({ row: storedRow() });
    const repo = new SupabaseSubscriptionRepository(db as never, 'user-1');
    await repo.create(input({ cancellationUrl: 'HTTPS://Example.com/cancel ' }));
    expect(db.calls[0].values?.cancellation_url).toBe('https://example.com/cancel');
  });

  it('deletes every owned table, including notification_preferences', async () => {
    const db = fakeSupabase();
    const repo = new SupabaseProfileRepository(db as never, 'user-1');
    await repo.deleteAccountData();
    const tables = db.calls.map((c) => c.table).sort();
    expect(tables).toEqual(
      ['billing_events', 'notification_preferences', 'notification_records', 'profiles', 'subscriptions'].sort(),
    );
    // Every child table is scoped by user_id; profiles is keyed by id.
    for (const call of db.calls) {
      if (call.table === 'profiles') expect(call.filters).toEqual([['id', 'user-1']]);
      else expect(call.filters).toEqual([['user_id', 'user-1']]);
    }
  });

  it('reports a partial deletion instead of pretending it succeeded', async () => {
    const db = fakeSupabase({ failOn: ['billing_events'] });
    const repo = new SupabaseProfileRepository(db as never, 'user-1');
    await expect(repo.deleteAccountData()).rejects.toBeInstanceOf(RepositoryError);
    // The other tables were still attempted (retry-friendly ordering), and the
    // caller sees an error rather than a silent success.
    expect(db.calls.length).toBe(5);
  });
});
