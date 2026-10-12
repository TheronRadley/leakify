/**
 * Supabase repositories. All queries scope to the authenticated user; the
 * database additionally enforces per-user access via RLS, so authorization
 * never relies on the client alone. Rows are validated/mapped at the boundary
 * and errors are converted to user-safe RepositoryErrors.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  RepositoryError,
  type AccountDeletionResult,
  type BillingEventRepository,
  type NotificationSettingsRepository,
  type ProfileRepository,
  type SubscriptionInput,
  type SubscriptionPatch,
  type SubscriptionRepository,
} from '@/services/repository';
import type {
  BillingEvent,
  BillingIntervalValue,
  CategoryKey,
  NotificationSettings,
  Profile,
  ReminderPreferences,
  Subscription,
  SubscriptionStatus,
} from '@/types';

/* ---------- row <-> domain mapping ---------- */

interface SubscriptionRow {
  id: string;
  user_id: string;
  name: string;
  provider: string | null;
  category: string;
  amount_cents: number;
  currency: string;
  interval_every: number;
  interval_unit: string;
  start_date: string | null;
  next_billing_date: string | null;
  trial_end_date: string | null;
  status: string;
  payment_method_label: string | null;
  cancellation_url: string | null;
  cancellation_notes: string | null;
  notes: string | null;
  reminders: ReminderPreferences | null;
  flagged_unused: boolean;
  is_cancel_candidate: boolean;
  canceled_at: string | null;
  archived_at: string | null;
  price_history: Subscription['priceHistory'] | null;
  created_at: string;
  updated_at: string;
}

function rowToSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    provider: row.provider,
    category: row.category as CategoryKey,
    amountCents: row.amount_cents,
    currency: row.currency,
    interval: { every: row.interval_every, unit: row.interval_unit } as BillingIntervalValue,
    startDate: row.start_date,
    nextBillingDate: row.next_billing_date,
    trialEndDate: row.trial_end_date,
    status: row.status as SubscriptionStatus,
    paymentMethodLabel: row.payment_method_label,
    cancellationUrl: row.cancellation_url,
    cancellationNotes: row.cancellation_notes,
    notes: row.notes,
    reminders: row.reminders ?? { enabled: true, renewalLeadDays: [3, 1, 0], trialLeadDays: [1] },
    flaggedUnused: row.flagged_unused,
    isCancelCandidate: row.is_cancel_candidate,
    canceledAt: row.canceled_at,
    archivedAt: row.archived_at,
    priceHistory: row.price_history ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function subscriptionToRow(input: Partial<SubscriptionInput> & Partial<Subscription>) {
  const row: Record<string, unknown> = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.provider !== undefined) row.provider = input.provider;
  if (input.category !== undefined) row.category = input.category;
  if (input.amountCents !== undefined) row.amount_cents = input.amountCents;
  if (input.currency !== undefined) row.currency = input.currency;
  if (input.interval !== undefined) {
    row.interval_every = input.interval.every;
    row.interval_unit = input.interval.unit;
  }
  if (input.startDate !== undefined) row.start_date = input.startDate;
  if (input.nextBillingDate !== undefined) row.next_billing_date = input.nextBillingDate;
  if (input.trialEndDate !== undefined) row.trial_end_date = input.trialEndDate;
  if (input.status !== undefined) row.status = input.status;
  if (input.paymentMethodLabel !== undefined) row.payment_method_label = input.paymentMethodLabel;
  if (input.cancellationUrl !== undefined) row.cancellation_url = input.cancellationUrl;
  if (input.cancellationNotes !== undefined) row.cancellation_notes = input.cancellationNotes;
  if (input.notes !== undefined) row.notes = input.notes;
  if (input.reminders !== undefined) row.reminders = input.reminders;
  if (input.flaggedUnused !== undefined) row.flagged_unused = input.flaggedUnused;
  if (input.isCancelCandidate !== undefined) row.is_cancel_candidate = input.isCancelCandidate;
  if (input.archivedAt !== undefined) row.archived_at = input.archivedAt;
  if (input.canceledAt !== undefined) row.canceled_at = input.canceledAt;
  if (input.priceHistory !== undefined) row.price_history = input.priceHistory;
  return row;
}

function toRepoError(err: { message?: string; code?: string } | null): RepositoryError {
  const message = (err?.message ?? '').toLowerCase();
  if (message.includes('row-level security') || err?.code === '42501') {
    return new RepositoryError('unauthorized', 'You are not allowed to access this record.');
  }
  if (message.includes('network') || message.includes('fetch')) {
    return new RepositoryError('network', 'Network error. Check your connection and try again.');
  }
  return new RepositoryError('unknown', 'Something went wrong while saving. Please try again.');
}

export class SupabaseSubscriptionRepository implements SubscriptionRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  async list(): Promise<Subscription[]> {
    const { data, error } = await this.db
      .from('subscriptions')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: true });
    if (error) throw toRepoError(error);
    return (data as SubscriptionRow[]).map(rowToSubscription);
  }

  async get(id: string): Promise<Subscription | null> {
    const { data, error } = await this.db
      .from('subscriptions')
      .select('*')
      .eq('user_id', this.userId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw toRepoError(error);
    return data ? rowToSubscription(data as SubscriptionRow) : null;
  }

  async create(input: SubscriptionInput): Promise<Subscription> {
    const { data, error } = await this.db
      .from('subscriptions')
      .insert({ ...subscriptionToRow(input), user_id: this.userId, canceled_at: input.status === 'canceled' ? new Date().toISOString() : null })
      .select('*')
      .single();
    if (error) throw toRepoError(error);
    return rowToSubscription(data as SubscriptionRow);
  }

  async update(id: string, patch: SubscriptionPatch): Promise<Subscription> {
    const current = await this.get(id);
    if (!current) throw new RepositoryError('not_found', 'Subscription not found.');

    // Preserve price history when the amount or currency changes.
    const merged: Partial<Subscription> = { ...patch };
    if (patch.amountCents !== undefined && patch.amountCents !== current.amountCents) {
      merged.priceHistory = [
        ...current.priceHistory,
        {
          amountCents: current.amountCents,
          currency: current.currency,
          effectiveFrom: current.updatedAt.slice(0, 10),
        },
      ];
    }
    if (patch.status !== undefined && patch.status !== current.status) {
      merged.canceledAt = patch.status === 'canceled' ? new Date().toISOString() : null;
    }

    const { data, error } = await this.db
      .from('subscriptions')
      .update({ ...subscriptionToRow(merged), updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', this.userId)
      .select('*')
      .single();
    if (error) throw toRepoError(error);
    if (!data) throw new RepositoryError('not_found', 'Subscription not found.');
    return rowToSubscription(data as SubscriptionRow);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db.from('subscriptions').delete().eq('id', id).eq('user_id', this.userId);
    if (error) throw toRepoError(error);
  }

  async setStatus(id: string, status: SubscriptionStatus): Promise<Subscription> {
    return this.update(id, { status });
  }

  async recordPayment(id: string, actualDateISO: string, actualAmountCents: number): Promise<Subscription> {
    const sub = await this.get(id);
    if (!sub) throw new RepositoryError('not_found', 'Subscription not found.');
    if (!sub.nextBillingDate) throw new RepositoryError('validation', 'No next billing date to roll forward.');

    // Two-step write (event, then roll the date forward) — there is no
    // cross-table transaction from the client, and that is deliberate: the
    // logic stays client-visible and auditable. The step is made *recoverable*
    // instead of atomic by keying the event on the occurrence it records: a
    // retry after a partial failure finds the event that is already there and
    // skips the insert, so a failed pair can never produce a duplicate charge
    // record (audit N-04).
    const { addInterval, parseISODate, toISODate } = await import('@/lib/dates');
    const anchor = parseISODate(sub.nextBillingDate);
    if (!anchor) throw new RepositoryError('validation', 'Saved billing date is invalid.');
    const next = toISODate(addInterval(anchor, sub.interval, 1));

    const { data: existing, error: lookupError } = await this.db
      .from('billing_events')
      .select('id')
      .eq('subscription_id', sub.id)
      .eq('user_id', this.userId)
      .eq('expected_date', sub.nextBillingDate);
    if (lookupError) throw toRepoError(lookupError);
    const alreadyRecorded = Array.isArray(existing) && existing.length > 0;

    if (!alreadyRecorded) {
      const { error: eventError } = await this.db.from('billing_events').insert({
        subscription_id: sub.id,
        user_id: this.userId,
        expected_date: sub.nextBillingDate,
        amount_cents: sub.amountCents,
        currency: sub.currency,
        type: sub.status === 'trialing' ? 'trial_end' : 'renewal',
        status: 'charged',
        actual_date: actualDateISO,
        actual_amount_cents: actualAmountCents,
      });
      if (eventError) throw toRepoError(eventError);
    }
    return this.update(id, {
      nextBillingDate: next,
      ...(sub.status === 'trialing' ? { status: 'active' as const } : {}),
    });
  }
}

interface BillingEventRow {
  id: string;
  subscription_id: string;
  user_id: string;
  expected_date: string;
  amount_cents: number;
  currency: string;
  type: BillingEvent['type'];
  status: BillingEvent['status'];
  actual_date: string | null;
  actual_amount_cents: number | null;
  created_at: string;
}

function rowToBillingEvent(row: BillingEventRow): BillingEvent {
  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    userId: row.user_id,
    expectedDate: row.expected_date,
    amountCents: row.amount_cents,
    currency: row.currency,
    type: row.type,
    status: row.status,
    actualDate: row.actual_date,
    actualAmountCents: row.actual_amount_cents,
    createdAt: row.created_at,
  };
}

export class SupabaseBillingEventRepository implements BillingEventRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  async listForSubscription(subscriptionId: string): Promise<BillingEvent[]> {
    const { data, error } = await this.db
      .from('billing_events')
      .select('*')
      .eq('user_id', this.userId)
      .eq('subscription_id', subscriptionId)
      .order('expected_date', { ascending: false });
    if (error) throw toRepoError(error);
    return (data as BillingEventRow[]).map(rowToBillingEvent);
  }

  async listAll(): Promise<BillingEvent[]> {
    const { data, error } = await this.db
      .from('billing_events')
      .select('*')
      .eq('user_id', this.userId)
      .order('expected_date', { ascending: false });
    if (error) throw toRepoError(error);
    return (data as BillingEventRow[]).map(rowToBillingEvent);
  }
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  preferred_currency: string | null;
  locale: string | null;
  timezone: string | null;
  theme_preference: string | null;
  created_at: string;
  updated_at: string;
}

export class SupabaseProfileRepository implements ProfileRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  async get(): Promise<Profile | null> {
    const { data, error } = await this.db
      .from('profiles')
      .select('*')
      .eq('id', this.userId)
      .maybeSingle();
    if (error) throw toRepoError(error);
    if (!data) return null;
    const row = data as ProfileRow;
    return {
      id: row.id,
      displayName: row.display_name ?? 'Leakify User',
      preferredCurrency: row.preferred_currency ?? 'USD',
      locale: row.locale ?? 'en-US',
      timezone: row.timezone ?? 'UTC',
      themePreference: (row.theme_preference as Profile['themePreference']) ?? 'system',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async upsert(patch: Partial<Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Profile> {
    const row: Record<string, unknown> = { id: this.userId, updated_at: new Date().toISOString() };
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.preferredCurrency !== undefined) row.preferred_currency = patch.preferredCurrency;
    if (patch.locale !== undefined) row.locale = patch.locale;
    if (patch.timezone !== undefined) row.timezone = patch.timezone;
    if (patch.themePreference !== undefined) row.theme_preference = patch.themePreference;

    const { data, error } = await this.db.from('profiles').upsert(row).select('*').single();
    if (error) throw toRepoError(error);
    const saved = data as ProfileRow;
    return {
      id: saved.id,
      displayName: saved.display_name ?? 'Leakify User',
      preferredCurrency: saved.preferred_currency ?? 'USD',
      locale: saved.locale ?? 'en-US',
      timezone: saved.timezone ?? 'UTC',
      themePreference: (saved.theme_preference as Profile['themePreference']) ?? 'system',
      createdAt: saved.created_at,
      updatedAt: saved.updated_at,
    };
  }

  /**
   * Delete everything, including the auth account itself.
   *
   * Preferred path: the `delete-account` Edge Function (supabase/functions/
   * delete-account). It verifies the caller's JWT server-side, deletes every
   * row owned by that user, then removes the `auth.users` row through the
   * Admin API — which also drops sessions, refresh tokens, identities and MFA
   * factors. The service-role key it needs never leaves the server.
   *
   * Fallback (function not deployed / call failed): delete the rows the client
   * is allowed to delete and report honestly that the auth account survived.
   * The UI shows `warning` rather than claiming a full account deletion.
   */
  async deleteAccountData(): Promise<AccountDeletionResult> {
    let invokeError: unknown = null;
    try {
      const { error } = await this.db.functions.invoke(DELETE_ACCOUNT_FUNCTION);
      invokeError = error;
    } catch (err) {
      invokeError = err;
    }
    if (!invokeError) {
      return { rowsDeleted: true, accountDeleted: true };
    }

    const rowsDeleted = await this.deleteOwnedRows();
    const status = functionErrorStatus(invokeError);
    const missing =
      status === 404 ||
      status === 501 ||
      /not found|not deployed|no function|edge function/i.test(errorMessage(invokeError));
    return {
      rowsDeleted,
      accountDeleted: false,
      warning: missing
        ? 'Your Leakify data was deleted, but the sign-in account could not be removed because the delete-account function is not deployed on this Supabase project. Ask support@leakify.app to finish removing it.'
        : 'Your Leakify data was deleted, but the sign-in account could not be removed just now. Try again, or ask support@leakify.app to finish removing it.',
    };
  }

  /**
   * Deletes every row this user owns. `notification_preferences` is included —
   * it was missed before, so preference rows outlived "delete all my data"
   * (audit N-02). Order: children first, then subscriptions, then the profile.
   * Each failure is collected rather than thrown so one stubborn table cannot
   * leave the others behind.
   */
  private async deleteOwnedRows(): Promise<boolean> {
    const targets: { table: string; column: string }[] = [
      { table: 'notification_records', column: 'user_id' },
      { table: 'billing_events', column: 'user_id' },
      { table: 'notification_preferences', column: 'user_id' },
      { table: 'subscriptions', column: 'user_id' },
      { table: 'profiles', column: 'id' },
    ];
    let allDeleted = true;
    for (const { table, column } of targets) {
      const { error } = await this.db.from(table).delete().eq(column, this.userId);
      if (error) allDeleted = false;
    }
    return allDeleted;
  }
}

/** Name of the server-side deletion function (supabase/functions/delete-account). */
export const DELETE_ACCOUNT_FUNCTION = 'delete-account';

function functionErrorStatus(error: unknown): number | null {
  const context = (error as { context?: unknown } | null)?.context;
  const status = (context as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : '';
}

export class SupabaseNotificationSettingsRepository implements NotificationSettingsRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  async get(): Promise<NotificationSettings> {
    const { data } = await this.db
      .from('notification_preferences')
      .select('*')
      .eq('user_id', this.userId)
      .maybeSingle();
    if (!data) {
      return {
        renewalLeadDays: [3, 1, 0],
        trialLeadDays: [1],
        weeklyDigestEnabled: false,
        genericLockScreenText: false,
        permissionStatus: 'unknown',
      };
    }
    const row = data as {
      renewal_lead_days: number[];
      trial_lead_days: number[];
      weekly_digest_enabled: boolean;
      generic_lock_screen_text: boolean | null;
    };
    return {
      renewalLeadDays: row.renewal_lead_days ?? [3, 1, 0],
      trialLeadDays: row.trial_lead_days ?? [1],
      weeklyDigestEnabled: row.weekly_digest_enabled ?? false,
      genericLockScreenText: row.generic_lock_screen_text ?? false,
      permissionStatus: 'unknown',
    };
  }

  async update(patch: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const row: Record<string, unknown> = { user_id: this.userId, updated_at: new Date().toISOString() };
    if (patch.renewalLeadDays !== undefined) row.renewal_lead_days = patch.renewalLeadDays;
    if (patch.trialLeadDays !== undefined) row.trial_lead_days = patch.trialLeadDays;
    if (patch.weeklyDigestEnabled !== undefined) row.weekly_digest_enabled = patch.weeklyDigestEnabled;
    if (patch.genericLockScreenText !== undefined) row.generic_lock_screen_text = patch.genericLockScreenText;
    const { error } = await this.db.from('notification_preferences').upsert(row);
    if (error) throw toRepoError(error);
    return { ...(await this.get()), permissionStatus: patch.permissionStatus ?? 'unknown' };
  }
}
