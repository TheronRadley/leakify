/**
 * Leakify domain models.
 *
 * Money is always stored as integer minor units (e.g. cents) together with an
 * ISO 4217 currency code. Amounts in different currencies are never summed
 * together — aggregations are grouped per currency (see lib/billing.ts).
 *
 * Dates are stored as local-calendar ISO dates ("yyyy-MM-dd") because billing
 * schedules are calendar-based, not timestamp-based.
 */

export type CurrencyCode = string; // ISO 4217, e.g. "USD", "EUR", "JPY"

export type BillingIntervalUnit = 'day' | 'week' | 'month' | 'year';

export interface BillingIntervalValue {
  /** Repeat every N units, e.g. every=3, unit=month => quarterly. */
  every: number;
  unit: BillingIntervalUnit;
}

export type SubscriptionStatus = 'active' | 'trialing' | 'paused' | 'canceled';

export type CategoryKey =
  | 'streaming'
  | 'music'
  | 'software'
  | 'cloud_storage'
  | 'gaming'
  | 'fitness'
  | 'shopping'
  | 'utilities'
  | 'education'
  | 'other';

/**
 * Reminder lead times in whole days before the event.
 * 0 means "on the day of the charge / trial expiry".
 */
export interface ReminderPreferences {
  enabled: boolean;
  /** Days before a renewal charge, e.g. [7, 3, 1, 0]. */
  renewalLeadDays: number[];
  /** Days before a free trial expires, e.g. [1, 0]. */
  trialLeadDays: number[];
}

export interface PricePoint {
  amountCents: number;
  currency: CurrencyCode;
  /** ISO date from which this price applied. */
  effectiveFrom: string;
}

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  provider: string | null;
  category: CategoryKey;
  amountCents: number;
  currency: CurrencyCode;
  interval: BillingIntervalValue;
  /** ISO date the subscription originally started. */
  startDate: string | null;
  /** ISO date of the next expected charge. May be null when unknown. */
  nextBillingDate: string | null;
  /** ISO date the free trial ends, when applicable. */
  trialEndDate: string | null;
  status: SubscriptionStatus;
  paymentMethodLabel: string | null;
  cancellationUrl: string | null;
  cancellationNotes: string | null;
  notes: string | null;
  reminders: ReminderPreferences;
  /** User flagged this as possibly unused (leak detector input). */
  flaggedUnused: boolean;
  /** User marked this as a candidate for cancellation (savings estimate). */
  isCancelCandidate: boolean;
  /** When the user recorded they cancelled (NOT provider-verified). */
  canceledAt: string | null;
  archivedAt: string | null;
  priceHistory: PricePoint[];
  createdAt: string;
  updatedAt: string;
}

export type BillingEventType = 'first_charge' | 'renewal' | 'trial_end';
export type BillingEventStatus = 'expected' | 'charged' | 'skipped' | 'canceled';

export interface BillingEvent {
  id: string;
  subscriptionId: string;
  userId: string;
  expectedDate: string; // ISO date
  amountCents: number;
  currency: CurrencyCode;
  type: BillingEventType;
  status: BillingEventStatus;
  actualDate: string | null;
  actualAmountCents: number | null;
  createdAt: string;
}

export interface NotificationSettings {
  /** Default renewal reminder leads for new subscriptions, e.g. [3, 1, 0]. */
  renewalLeadDays: number[];
  /** Default trial reminders, e.g. [1]. */
  trialLeadDays: number[];
  weeklyDigestEnabled: boolean;
  /** Local notification permission as last observed by the app. */
  permissionStatus: 'unknown' | 'granted' | 'denied';
}

export type ScheduledNotificationType = 'renewal' | 'trial' | 'weekly_digest';

export interface ScheduledNotification {
  /**
   * Deterministic dedup key:
   * `${subscriptionId}:${occurrenceDate}:${type}:${leadDays}`.
   * Stable across edits so re-scheduling never duplicates.
   */
  key: string;
  subscriptionId: string | null;
  type: ScheduledNotificationType;
  occurrenceDate: string; // ISO date of renewal / trial end
  leadDays: number;
  /** Local time the OS should fire, ISO datetime. */
  triggerAt: string;
  /** Identifier returned by expo-notifications after scheduling. */
  osNotificationId: string;
  status: 'scheduled' | 'canceled';
  createdAt: string;
}

export interface Profile {
  id: string; // auth user id
  displayName: string;
  preferredCurrency: CurrencyCode;
  locale: string;
  timezone: string;
  themePreference: 'system' | 'light' | 'dark';
  createdAt: string;
  updatedAt: string;
}

/** Data access modes: cloud sync via Supabase, or local-only (demo / signed out). */
export type DataMode = 'demo' | 'local' | 'supabase';

export interface AuthUser {
  id: string;
  email: string;
}

/** Leak finding produced by features/subscriptions/leak-detector.ts */
export type LeakKind =
  | 'duplicate_candidate'
  | 'trial_ending'
  | 'missing_billing_date'
  | 'flagged_unused'
  | 'large_upcoming_total'
  | 'price_increase';

export interface LeakFinding {
  id: string;
  kind: LeakKind;
  subscriptionIds: string[];
  title: string;
  explanation: string;
  severity: 'info' | 'warning' | 'urgent';
  /** For savings-related findings, potential monthly saving per currency. */
  estimatedMonthlyCents?: { currency: CurrencyCode; amountCents: number }[];
}
