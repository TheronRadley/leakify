/**
 * Supabase repositories. All queries scope to the authenticated user; the
 * database additionally enforces per-user access via RLS, so authorization
 * never relies on the client alone. Rows are validated/mapped at the boundary
 * and errors are converted to user-safe RepositoryErrors.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { addInterval, parseISODate, toISODate } from '@/lib/dates';
import { createRequestId } from '@/lib/id';
import {
  assertSafeCancellationUrl,
  RepositoryError,
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

/**
 * Write-time URL gate, mirroring the local repository. RLS proves *who* owns a
 * row; this proves *what* may be stored in it, so a value that skipped the form
 * cannot end up as something `Linking.openURL` receives.
 */
function subscriptionToRow(input: Partial<SubscriptionInput> & Partial<Subscription>) {
  const row: Record<string, unknown> = {};
  if (input.cancellationUrl !== undefined) input = { ...input, cancellationUrl: assertSafeCancellationUrl(input.cancellationUrl) };
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

/**
 * Payment-specific error mapping. `leakify:*` prefixes are the RPC's own
 * signals; a missing function means the deployment is behind its migrations,
 * which must be said out loud instead of falling back to a non-atomic write.
 */
function toPaymentError(err: { message?: string; code?: string } | null): RepositoryError {
  const message = (err?.message ?? '').toLowerCase();
  if (message.includes('leakify:not_found')) {
    return new RepositoryError('not_found', 'Subscription not found.');
  }
  if (message.includes('leakify:no_next_billing_date')) {
    return new RepositoryError('validation', 'Add a next billing date before recording a payment.');
  }
  if (message.includes('leakify:invalid_next_billing_date')) {
    return new RepositoryError('validation', 'The next billing date could not be advanced. Refresh and try again.');
  }
  if (message.includes('leakify:invalid_amount')) {
    return new RepositoryError('validation', 'Payment amount must be zero or more.');
  }
  if (message.includes('record_payment') || message.includes('does not exist') || err?.code === 'PGRST202') {
    return new RepositoryError(
      'unknown',
      'Cloud payment recording is unavailable: the project is missing a database migration. No payment was recorded.',
    );
  }
  return toRepoError(err);
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

  /**
   * Record a charge and roll the schedule forward in ONE database transaction
   * (`record_payment`, see supabase/migrations/0004_record_payment_atomic.sql),
   * carrying a retry key so a timed-out request cannot double-book history.
   *
   * The recurrence step itself stays in TypeScript (`lib/dates`, anchor-based
   * and unit tested) — the SQL only refuses a date that does not move forward.
   * That split is deliberate: one source of truth for money/date math, one
   * transaction for durability.
   */
  async recordPayment(id: string, actualDateISO: string, actualAmountCents: number): Promise<Subscription> {
    const sub = await this.get(id);
    if (!sub) throw new RepositoryError('not_found', 'Subscription not found.');
    if (!sub.nextBillingDate) throw new RepositoryError('validation', 'No next billing date to roll forward.');

    const anchor = parseISODate(sub.nextBillingDate);
    if (!anchor) throw new RepositoryError('validation', 'Saved billing date is invalid.');
    const next = toISODate(addInterval(anchor, sub.interval, 1));

    const { data, error } = await this.db.rpc('record_payment', {
      p_subscription_id: sub.id,
      p_actual_date: actualDateISO,
      p_actual_amount_cents: actualAmountCents,
      p_next_billing_date: next,
      p_client_request_id: createRequestId(),
    });
    if (error) throw toPaymentError(error);
    if (!data) throw new RepositoryError('not_found', 'Subscription not found.');
    return rowToSubscription(data as SubscriptionRow);
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
   * Remove every row this user owns. Children are deleted before parents so a
   * mid-way failure leaves a retryable (not orphaned) state, and each call's
   * error is propagated — a swallowed delete used to be reported to the user as
   * a successful account wipe. `notification_preferences` is included; it was
   * the table the original version missed.
   *
   * Deleting the *auth identity* is not possible from a client (it needs the
   * admin API) — see `services/cloud-account.ts` + the `delete-account` Edge
   * Function. This method is the row-level half of a full deletion.
   */
  async deleteAccountData(): Promise<void> {
    // `user_id`-scoped tables first (children before parents), then `profiles`,
    // which is keyed by the auth id instead.
    const byUserId = ['notification_records', 'billing_events', 'notification_preferences', 'subscriptions'];
    const failed: string[] = [];

    for (const table of byUserId) {
      try {
        const { error } = await this.db.from(table).delete().eq('user_id', this.userId);
        if (error) failed.push(table);
      } catch {
        failed.push(table);
      }
    }
    try {
      const { error } = await this.db.from('profiles').delete().eq('id', this.userId);
      if (error) failed.push('profiles');
    } catch {
      failed.push('profiles');
    }

    if (failed.length > 0) {
      throw new RepositoryError('unknown', 'Some of your cloud data could not be deleted. Please try again.');
    }
  }
}

export class SupabaseNotificationSettingsRepository implements NotificationSettingsRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  async get(): Promise<NotificationSettings> {
    const { data, error } = await this.db
      .from('notification_preferences')
      .select('*')
      .eq('user_id', this.userId)
      .maybeSingle();
    // A read failure must not look like "you have no preferences": the store
    // would then happily write back defaults over real settings.
    if (error) throw toRepoError(error);
    if (!data) {
      return {
        previewMode: 'generic',
        renewalLeadDays: [3, 1, 0],
        trialLeadDays: [1],
        weeklyDigestEnabled: false,
        permissionStatus: 'unknown',
      };
    }
    const row = data as {
      renewal_lead_days: number[];
      trial_lead_days: number[];
      weekly_digest_enabled: boolean;
      preview_mode?: string | null;
    };
    return {
      previewMode: row.preview_mode === 'detailed' ? 'detailed' : 'generic',
      renewalLeadDays: row.renewal_lead_days ?? [3, 1, 0],
      trialLeadDays: row.trial_lead_days ?? [1],
      weeklyDigestEnabled: row.weekly_digest_enabled ?? false,
      permissionStatus: 'unknown',
    };
  }

  async update(patch: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const row: Record<string, unknown> = { user_id: this.userId, updated_at: new Date().toISOString() };
    if (patch.previewMode !== undefined) row.preview_mode = patch.previewMode;
    if (patch.renewalLeadDays !== undefined) row.renewal_lead_days = patch.renewalLeadDays;
    if (patch.trialLeadDays !== undefined) row.trial_lead_days = patch.trialLeadDays;
    if (patch.weeklyDigestEnabled !== undefined) row.weekly_digest_enabled = patch.weeklyDigestEnabled;
    const { error } = await this.db.from('notification_preferences').upsert(row);
    if (error) throw toRepoError(error);
    return { ...(await this.get()), permissionStatus: patch.permissionStatus ?? 'unknown' };
  }
}
