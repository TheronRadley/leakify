/**
 * Supabase repository behaviour, driven through a stub client.
 *
 * These exercise the shipped repository code paths (not re-implementations):
 * account deletion, including the audit's N-02 gap where
 * `notification_preferences` outlived "delete all my data", and the
 * idempotency that makes the two-step `recordPayment` recoverable (N-04).
 */
import {
  DELETE_ACCOUNT_FUNCTION,
  SupabaseProfileRepository,
  SupabaseSubscriptionRepository,
} from '@/services/supabase-repository';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Call {
  kind: 'from' | 'invoke';
  table?: string;
  fn?: string;
  ops: string[];
  args: unknown[][];
}

type QueryResult = { data?: unknown; error?: unknown };

function makeFakeClient(options: {
  respond?: (call: Call) => QueryResult;
  invoke?: (fn: string) => QueryResult;
} = {}) {
  const calls: Call[] = [];
  const respond = options.respond ?? (() => ({ data: null, error: null }));

  const from = (table: string) => {
    const call: Call = { kind: 'from', table, ops: [], args: [] };
    calls.push(call);
    // A thenable chain: every method records itself and returns the same proxy,
    // and awaiting it resolves through `respond`.
    let proxy: Record<string, unknown>;
    proxy = new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        if (prop === 'then') {
          return (onFulfilled: (v: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
            Promise.resolve()
              .then(() => respond(call))
              .then(onFulfilled, onRejected);
        }
        return (...args: unknown[]) => {
          call.ops.push(prop);
          call.args.push(args);
          return proxy;
        };
      },
    });
    return proxy;
  };

  return {
    calls,
    tables: () =>
      calls.filter((c) => c.kind === 'from').map((c) => `${c.table}:${c.ops.join('.')}`),
    client: { from, functions: { invoke: (fn: string) => {
      calls.push({ kind: 'invoke', fn, ops: [], args: [] });
      return Promise.resolve(options.invoke ? options.invoke(fn) : { data: null, error: null });
    } } } as unknown as SupabaseClient,
  };
}

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function subscriptionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: USER_ID,
    name: 'Netflix',
    provider: null,
    category: 'streaming',
    amount_cents: 1599,
    currency: 'USD',
    interval_every: 1,
    interval_unit: 'month',
    start_date: '2026-01-01',
    next_billing_date: '2026-11-01',
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

describe('SupabaseProfileRepository.deleteAccountData', () => {
  it('delegates to the delete-account Edge Function and reports a full deletion', async () => {
    const fake = makeFakeClient({ invoke: () => ({ data: { deleted: true }, error: null }) });
    const repo = new SupabaseProfileRepository(fake.client, USER_ID);

    const result = await repo.deleteAccountData();

    expect(result).toEqual({ rowsDeleted: true, accountDeleted: true });
    const invoked = fake.calls.filter((c) => c.kind === 'invoke');
    expect(invoked).toHaveLength(1);
    expect(invoked[0].fn).toBe(DELETE_ACCOUNT_FUNCTION);
    expect(DELETE_ACCOUNT_FUNCTION).toBe('delete-account');
    // The function deleted the rows server-side; the client must not repeat it.
    expect(fake.calls.filter((c) => c.kind === 'from')).toHaveLength(0);
  });

  it('falls back to client-side row deletion when the function is not deployed', async () => {
    const fake = makeFakeClient({
      invoke: () => ({ error: Object.assign(new Error('not found'), { context: { status: 404 } }) }),
    });
    const repo = new SupabaseProfileRepository(fake.client, USER_ID);

    const result = await repo.deleteAccountData();

    expect(result.rowsDeleted).toBe(true);
    expect(result.accountDeleted).toBe(false);
    expect(result.warning).toContain('not deployed');
    expect(result.warning).toContain('support@leakify.app');
  });

  it('deletes notification_preferences too — the table the old implementation missed (N-02)', async () => {
    const fake = makeFakeClient({
      invoke: () => ({ error: Object.assign(new Error('boom'), { context: { status: 404 } }) }),
    });
    const repo = new SupabaseProfileRepository(fake.client, USER_ID);

    await repo.deleteAccountData();

    const deletedTables = fake.calls
      .filter((c) => c.kind === 'from' && c.ops.includes('delete'))
      .map((c) => c.table);
    expect(deletedTables).toContain('notification_preferences');
    expect(deletedTables.sort()).toEqual(
      [
        'billing_events',
        'notification_preferences',
        'notification_records',
        'profiles',
        'subscriptions',
      ].sort(),
    );
    // Children before parents, so a cascade never races an explicit delete.
    expect(deletedTables.indexOf('subscriptions')).toBeGreaterThan(
      deletedTables.indexOf('billing_events'),
    );
  });

  it('scopes every fallback delete to the calling user', async () => {
    const fake = makeFakeClient({
      invoke: () => ({ error: new Error('network down') }),
    });
    const repo = new SupabaseProfileRepository(fake.client, USER_ID);

    await repo.deleteAccountData();

    for (const call of fake.calls.filter((c) => c.kind === 'from' && c.ops.includes('delete'))) {
      const eqIndex = call.ops.indexOf('eq');
      expect(call.args[eqIndex]).toEqual([call.table === 'profiles' ? 'id' : 'user_id', USER_ID]);
    }
  });

  it('reports a generic warning (not "not deployed") for a transport failure', async () => {
    const fake = makeFakeClient({ invoke: () => ({ error: new Error('Failed to send a request') }) });
    const repo = new SupabaseProfileRepository(fake.client, USER_ID);

    const result = await repo.deleteAccountData();

    expect(result.accountDeleted).toBe(false);
    expect(result.warning).toContain('could not be removed just now');
    expect(result.warning).not.toContain('not deployed');
  });

  it('reports failure honestly when a table delete is refused', async () => {
    const fake = makeFakeClient({
      invoke: () => ({ error: Object.assign(new Error('nope'), { context: { status: 404 } }) }),
      respond: (call) =>
        call.table === 'profiles' && call.ops.includes('delete')
          ? { error: { message: 'row-level security', code: '42501' } }
          : { data: null, error: null },
    });
    const repo = new SupabaseProfileRepository(fake.client, USER_ID);

    const result = await repo.deleteAccountData();

    expect(result.rowsDeleted).toBe(false);
    expect(result.accountDeleted).toBe(false);
  });
});

describe('SupabaseSubscriptionRepository.recordPayment', () => {
  const setup = (existingEvents: unknown[]) => {
    const inserts: Call[] = [];
    const updates: Call[] = [];
    const fake = makeFakeClient({
      respond: (call) => {
        if (call.table === 'subscriptions' && call.ops.includes('maybeSingle')) {
          return { data: subscriptionRow(), error: null };
        }
        if (call.table === 'subscriptions' && call.ops.includes('update')) {
          updates.push(call);
          return {
            data: subscriptionRow({ next_billing_date: '2026-12-01', updated_at: '2026-11-01T00:00:00.000Z' }),
            error: null,
          };
        }
        if (call.table === 'billing_events' && call.ops.includes('insert')) {
          inserts.push(call);
          return { data: null, error: null };
        }
        if (call.table === 'billing_events') {
          return { data: existingEvents, error: null };
        }
        return { data: null, error: null };
      },
    });
    return { fake, inserts, updates };
  };

  it('records the charge and rolls the billing date forward one interval', async () => {
    const { fake, inserts, updates } = setup([]);
    const repo = new SupabaseSubscriptionRepository(fake.client, USER_ID);

    const updated = await repo.recordPayment(
      '11111111-1111-4111-8111-111111111111',
      '2026-11-01',
      1599,
    );

    expect(inserts).toHaveLength(1);
    expect(inserts[0].args[0][0]).toMatchObject({
      expected_date: '2026-11-01',
      amount_cents: 1599,
      type: 'renewal',
      status: 'charged',
    });
    expect(updates).toHaveLength(1);
    expect(updates[0].args[0][0]).toMatchObject({ next_billing_date: '2026-12-01' });
    expect(updated.nextBillingDate).toBe('2026-12-01');
  });

  it('does not insert a duplicate event when a previous attempt already wrote one (N-04)', async () => {
    const { fake, inserts, updates } = setup([
      { id: 'existing-event', expected_date: '2026-11-01' },
    ]);
    const repo = new SupabaseSubscriptionRepository(fake.client, USER_ID);

    const updated = await repo.recordPayment(
      '11111111-1111-4111-8111-111111111111',
      '2026-11-01',
      1599,
    );

    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(1);
    expect(updated.nextBillingDate).toBe('2026-12-01');
  });

  it('looks the existing event up for the same subscription AND the same occurrence', async () => {
    const { fake } = setup([]);
    const repo = new SupabaseSubscriptionRepository(fake.client, USER_ID);

    await repo.recordPayment('11111111-1111-4111-8111-111111111111', '2026-11-01', 1599);

    const lookup = fake.calls.find(
      (c) => c.table === 'billing_events' && c.ops.includes('select'),
    );
    expect(lookup).toBeDefined();
    expect(lookup!.ops).toContain('eq');
    expect(lookup!.args).toEqual(
      expect.arrayContaining([
        ['subscription_id', '11111111-1111-4111-8111-111111111111'],
        ['user_id', USER_ID],
        ['expected_date', '2026-11-01'],
      ]),
    );
  });

  it('fails loudly when the duplicate check itself fails', async () => {
    const fake = makeFakeClient({
      respond: (call) => {
        if (call.table === 'subscriptions') return { data: subscriptionRow(), error: null };
        if (call.table === 'billing_events') return { data: null, error: { message: 'fetch failed' } };
        return { data: null, error: null };
      },
    });
    const repo = new SupabaseSubscriptionRepository(fake.client, USER_ID);

    await expect(
      repo.recordPayment('11111111-1111-4111-8111-111111111111', '2026-11-01', 1599),
    ).rejects.toMatchObject({ code: 'network' });
  });
});
