/**
 * Pure reminder-scheduling engine. No expo-notifications imports — this module
 * computes WHAT should be scheduled and WHAT should be cancelled so it can be
 * unit-tested in plain Node. features/notifications/service.ts applies the
 * results to the OS.
 *
 * Reliability rules implemented here:
 * - Deterministic dedup keys, so editing a subscription reschedules instead of
 *   duplicating, and unrelated updates do not churn notifications.
 * - Only active / trialing, non-archived subscriptions with reminders enabled
 *   ever produce notifications. Canceled, paused and archived ones do not.
 * - Trigger times are computed on the user's local calendar; past or invalid
 *   dates are dropped gracefully.
 * - The desired set is capped (platforms limit scheduled local notifications,
 *   e.g. 64 on iOS) keeping the soonest triggers first.
 */
import { formatMoney } from '@/lib/currency';
import {
  daysBetween,
  firstOccurrenceIndex,
  isValidISODate,
  nthOccurrence,
  parseISODate,
  relativeDayLabel,
  subtractDaysISO,
  toISODate,
} from '@/lib/dates';
import type {
  CurrencyCode,
  ReminderPreferences,
  ScheduledNotification,
  Subscription,
} from '@/types';

/** Leave headroom under the iOS limit of 64 scheduled local notifications. */
export const MAX_SCHEDULED_NOTIFICATIONS = 48;

/** How far ahead reminders are pre-scheduled. Re-synced on every app open / edit. */
export const DEFAULT_HORIZON_DAYS = 60;

/** Local clock time reminders fire at (9:00 AM user time). */
export const REMINDER_FIRE_HOUR = 9;

export type ReminderType = 'renewal' | 'trial';

export interface ReminderPlan {
  /** `${subscriptionId}:${occurrenceDate}:${type}:${leadDays}` — stable dedup key. */
  key: string;
  subscriptionId: string;
  type: ReminderType;
  occurrenceDate: string; // ISO date
  leadDays: number;
  triggerAt: string; // ISO datetime
  title: string;
  body: string;
}

export interface DigestPlan {
  key: string;
  type: 'weekly_digest';
  triggerAt: string;
  title: string;
  body: string;
}

export function reminderKey(
  subscriptionId: string,
  occurrenceDate: string,
  type: ReminderType,
  leadDays: number,
): string {
  return `${subscriptionId}:${occurrenceDate}:${type}:${leadDays}`;
}

/** True when the subscription should schedule reminders right now. */
export function isReminderEligible(sub: Subscription): boolean {
  if (sub.archivedAt) return false;
  if (sub.status !== 'active' && sub.status !== 'trialing') return false;
  return sub.reminders.enabled;
}

function occurrenceDatesWithin(
  anchorISO: string,
  interval: Subscription['interval'],
  refISO: string,
  horizonDays: number,
): string[] {
  const dates: string[] = [];
  if (!isValidISODate(anchorISO) || !isValidISODate(refISO)) return dates;
  // Enumerate occurrences by anchor index — never by chaining — so month-end
  // anchors (29th/30th/31st) never drift (see lib/dates).
  const firstIndex = firstOccurrenceIndex(anchorISO, interval, refISO);
  if (firstIndex === null) return dates;
  for (let n = firstIndex; n < firstIndex + 800; n += 1) {
    const occurrence = nthOccurrence(anchorISO, interval, n);
    if (!occurrence) break;
    const out = daysBetween(refISO, occurrence);
    if (out === null || out > horizonDays) break;
    if (out >= 0) dates.push(occurrence);
  }
  return dates;
}

function triggerDateTime(occurrenceDate: string, leadDays: number): Date | null {
  const triggerDateISO = subtractDaysISO(occurrenceDate, leadDays);
  const parsed = triggerDateISO ? parseISODate(triggerDateISO) : null;
  if (!parsed) return null;
  parsed.setHours(REMINDER_FIRE_HOUR, 0, 0, 0);
  return parsed;
}

export function renewalCopy(
  name: string,
  amountCents: number,
  currency: CurrencyCode,
  occurrenceDate: string,
  leadDays: number,
  refISO: string,
): { title: string; body: string } {
  const amount = formatMoney(amountCents, currency);
  if (leadDays === 0) {
    return {
      title: `${name} bills today — ${amount}`,
      body: 'Review it now or let the payment go through.',
    };
  }
  const when = relativeDayLabel(occurrenceDate, refISO) ?? `on ${occurrenceDate}`;
  return {
    title: `Your ${name} renewal is coming up ${when === 'Tomorrow' ? 'tomorrow' : `in ${leadDays} day${leadDays === 1 ? '' : 's'}`} — ${amount}`,
    body: `Charged ${when}. Cancel or pause before then if you no longer need it.`,
  };
}

export function trialCopy(
  name: string,
  occurrenceDate: string,
  leadDays: number,
  refISO: string,
): { title: string; body: string } {
  if (leadDays === 0) {
    return {
      title: `Your ${name} free trial ends today`,
      body: 'Review it before you are charged.',
    };
  }
  const when = relativeDayLabel(occurrenceDate, refISO);
  const whenText = when === 'Tomorrow' ? 'tomorrow' : `in ${leadDays} day${leadDays === 1 ? '' : 's'}`;
  return {
    title: `Your ${name} free trial ends ${whenText}`,
    body: 'Review it before you are charged. Cancel in time to avoid the payment.',
  };
}

export interface EngineOptions {
  horizonDays?: number;
  /** Current local ISO datetime, injected for testability. */
  nowISO?: string;
}

/**
 * Compute every reminder the app wants scheduled for the given subscriptions.
 */
export function computeReminderPlans(subs: Subscription[], options: EngineOptions = {}): ReminderPlan[] {
  const now = options.nowISO ? new Date(options.nowISO) : new Date();
  const refISO = toISODate(now);
  const horizonDays = options.horizonDays ?? DEFAULT_HORIZON_DAYS;
  const plans: ReminderPlan[] = [];

  for (const sub of subs) {
    if (!isReminderEligible(sub)) continue;
    const prefs: ReminderPreferences = sub.reminders;

    if (isValidISODate(sub.nextBillingDate)) {
      const occurrences = occurrenceDatesWithin(sub.nextBillingDate!, sub.interval, refISO, horizonDays);
      for (const occurrenceDate of occurrences) {
        for (const lead of prefs.renewalLeadDays) {
          const trigger = triggerDateTime(occurrenceDate, lead);
          if (!trigger || trigger.getTime() <= now.getTime()) continue;
          const copy = renewalCopy(sub.name, sub.amountCents, sub.currency, occurrenceDate, lead, refISO);
          plans.push({
            key: reminderKey(sub.id, occurrenceDate, 'renewal', lead),
            subscriptionId: sub.id,
            type: 'renewal',
            occurrenceDate,
            leadDays: lead,
            triggerAt: trigger.toISOString(),
            ...copy,
          });
        }
      }
    }

    if (sub.status === 'trialing' && isValidISODate(sub.trialEndDate)) {
      const daysUntilTrialEnd = daysBetween(refISO, sub.trialEndDate!);
      if (daysUntilTrialEnd !== null && daysUntilTrialEnd >= 0 && daysUntilTrialEnd <= horizonDays) {
        for (const lead of prefs.trialLeadDays) {
          const trigger = triggerDateTime(sub.trialEndDate!, lead);
          if (!trigger || trigger.getTime() <= now.getTime()) continue;
          const copy = trialCopy(sub.name, sub.trialEndDate!, lead, refISO);
          plans.push({
            key: reminderKey(sub.id, sub.trialEndDate!, 'trial', lead),
            subscriptionId: sub.id,
            type: 'trial',
            occurrenceDate: sub.trialEndDate!,
            leadDays: lead,
            triggerAt: trigger.toISOString(),
            ...copy,
          });
        }
      }
    }
  }

  // Soonest first, then deterministic tie-break.
  return plans
    .sort((a, b) => a.triggerAt.localeCompare(b.triggerAt) || a.key.localeCompare(b.key))
    .slice(0, MAX_SCHEDULED_NOTIFICATIONS);
}

/** Compute the weekly digest plan ("N payments this week") for next Monday. */
export function computeDigestPlan(
  subs: Subscription[],
  options: EngineOptions = {},
): DigestPlan | null {
  const now = options.nowISO ? new Date(options.nowISO) : new Date();
  const active = subs.filter(
    (s) => !s.archivedAt && (s.status === 'active' || s.status === 'trialing') && s.nextBillingDate,
  );

  // Count charges in the upcoming Mon–Sun week.
  const nextMonday = new Date(now);
  const day = nextMonday.getDay(); // 0 Sun ... 6 Sat
  nextMonday.setDate(nextMonday.getDate() + ((8 - day) % 7 || 7));
  nextMonday.setHours(REMINDER_FIRE_HOUR, 0, 0, 0);
  const weekStartISO = toISODate(nextMonday);

  const paying = active.filter((s) => {
    const within = daysBetween(weekStartISO, s.nextBillingDate!);
    return within !== null && within >= 0 && within <= 6;
  });
  if (paying.length === 0) return null;

  return {
    key: `weekly_digest:${weekStartISO}`,
    type: 'weekly_digest',
    triggerAt: nextMonday.toISOString(),
    title: `You have ${paying.length} subscription payment${paying.length === 1 ? '' : 's'} scheduled this week`,
    body: 'Open Leakify to review what is coming before you are charged.',
  };
}

export interface ScheduleDiff {
  toSchedule: (ReminderPlan | DigestPlan)[];
  toCancel: ScheduledNotification[];
}

/**
 * Diff desired plans against the persisted schedule. Only new keys are
 * scheduled and only obsolete keys are cancelled — identical reminders are
 * left untouched, which is what prevents duplicates after repeated edits.
 */
export function diffScheduledNotifications(
  desired: (ReminderPlan | DigestPlan)[],
  existing: ScheduledNotification[],
): ScheduleDiff {
  const existingByKey = new Map(existing.filter((e) => e.status === 'scheduled').map((e) => [e.key, e]));
  const desiredKeys = new Set(desired.map((d) => d.key));

  const toSchedule = desired.filter((d) => !existingByKey.has(d.key));
  const toCancel = existing.filter((e) => e.status === 'scheduled' && !desiredKeys.has(e.key));
  return { toSchedule, toCancel };
}
