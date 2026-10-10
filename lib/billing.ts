/**
 * Recurring-cost calculations. All results are integer minor units (cents).
 *
 * Monthly-equivalent math uses exact per-year period counts:
 *   day => 365/yr, week => 52/yr, month => 12/yr, year => 1/yr.
 * A charge of `amountCents` every N units costs
 *   amountCents * (periodsPerYear / N) per year, and annual/12 per month.
 * The annual projection is defined as monthly * 12 so the two headline
 * figures shown to users are always consistent.
 */
import { daysBetween } from '@/lib/dates';
import type {
  BillingIntervalValue,
  CategoryKey,
  CurrencyCode,
  Subscription,
} from '@/types';

export const INTERVAL_PRESETS = [
  { key: 'weekly', label: 'Weekly', every: 1, unit: 'week' },
  { key: 'monthly', label: 'Monthly', every: 1, unit: 'month' },
  { key: 'quarterly', label: 'Every 3 months', every: 3, unit: 'month' },
  { key: 'semiannual', label: 'Every 6 months', every: 6, unit: 'month' },
  { key: 'yearly', label: 'Yearly', every: 1, unit: 'year' },
  { key: 'custom', label: 'Custom', every: 1, unit: 'month' },
] as const;

export type IntervalPresetKey = (typeof INTERVAL_PRESETS)[number]['key'];

export function intervalToPresetKey(interval: BillingIntervalValue): IntervalPresetKey {
  for (const preset of INTERVAL_PRESETS) {
    if (preset.key !== 'custom' && preset.every === interval.every && preset.unit === interval.unit) {
      return preset.key;
    }
  }
  return 'custom';
}

const PERIODS_PER_YEAR: Record<BillingIntervalValue['unit'], number> = {
  day: 365,
  week: 52,
  month: 12,
  year: 1,
};

/** Average charges per month for an interval. */
export function periodsPerMonth(interval: BillingIntervalValue): number {
  return PERIODS_PER_YEAR[interval.unit] / (12 * Math.max(1, interval.every));
}

/** Monthly-equivalent cost in minor units, rounded to the nearest cent. */
export function monthlyEquivalentCents(amountCents: number, interval: BillingIntervalValue): number {
  return Math.round(amountCents * periodsPerMonth(interval));
}

/** Annual projection = twelve months of the current monthly equivalent. */
export function annualEquivalentCents(amountCents: number, interval: BillingIntervalValue): number {
  return monthlyEquivalentCents(amountCents, interval) * 12;
}

/** Subscriptions whose cost contributes to recurring-spend totals. */
export function contributesToRecurringSpend(sub: Subscription): boolean {
  return !sub.archivedAt && (sub.status === 'active' || sub.status === 'trialing');
}

export interface CurrencyAmount {
  currency: CurrencyCode;
  amountCents: number;
}

/** Monthly recurring spend grouped by currency — unlike currencies never mix. */
export function monthlyRecurringByCurrency(subs: Subscription[]): CurrencyAmount[] {
  const totals = new Map<CurrencyCode, number>();
  for (const sub of subs) {
    if (!contributesToRecurringSpend(sub)) continue;
    totals.set(
      sub.currency,
      (totals.get(sub.currency) ?? 0) + monthlyEquivalentCents(sub.amountCents, sub.interval),
    );
  }
  return toSortedAmounts(totals);
}

/** Annual projection grouped by currency (monthly * 12). */
export function annualProjectionByCurrency(subs: Subscription[]): CurrencyAmount[] {
  return monthlyRecurringByCurrency(subs).map((a) => ({
    currency: a.currency,
    amountCents: a.amountCents * 12,
  }));
}

/**
 * Sum of charges expected within `withinDays` days from `refISO` (inclusive),
 * grouped by currency. Uses each subscription's saved next billing date.
 */
export function upcomingChargesByCurrency(
  subs: Subscription[],
  refISO: string,
  withinDays: number,
): CurrencyAmount[] {
  const totals = new Map<CurrencyCode, number>();
  for (const sub of subs) {
    if (!contributesToRecurringSpend(sub) || !sub.nextBillingDate) continue;
    const days = daysBetween(refISO, sub.nextBillingDate);
    if (days === null || days < 0 || days > withinDays) continue;
    totals.set(sub.currency, (totals.get(sub.currency) ?? 0) + sub.amountCents);
  }
  return toSortedAmounts(totals);
}

function toSortedAmounts(map: Map<CurrencyCode, number>): CurrencyAmount[] {
  return [...map.entries()]
    .map(([currency, amountCents]) => ({ currency, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents || a.currency.localeCompare(b.currency));
}

export interface CategorySpend {
  category: CategoryKey;
  amounts: CurrencyAmount[];
  totalCentsInCurrency: (currency: CurrencyCode) => number;
  subscriptionIds: string[];
}

/** Monthly recurring spend per category, currencies kept separate. */
export function spendByCategory(subs: Subscription[]): CategorySpend[] {
  const byCategory = new Map<CategoryKey, Map<CurrencyCode, number>>();
  const ids = new Map<CategoryKey, string[]>();
  for (const sub of subs) {
    if (!contributesToRecurringSpend(sub)) continue;
    const bucket = byCategory.get(sub.category) ?? new Map<CurrencyCode, number>();
    bucket.set(sub.currency, (bucket.get(sub.currency) ?? 0) + monthlyEquivalentCents(sub.amountCents, sub.interval));
    byCategory.set(sub.category, bucket);
    ids.set(sub.category, [...(ids.get(sub.category) ?? []), sub.id]);
  }
  const result: CategorySpend[] = [...byCategory.entries()].map(([category, amounts]) => {
    const list = toSortedAmounts(amounts);
    return {
      category,
      amounts: list,
      totalCentsInCurrency: (currency: CurrencyCode) =>
        list.find((a) => a.currency === currency)?.amountCents ?? 0,
      subscriptionIds: ids.get(category) ?? [],
    };
  });
  return result.sort(
    (a, b) => (b.amounts[0]?.amountCents ?? 0) - (a.amounts[0]?.amountCents ?? 0),
  );
}

/**
 * Potential monthly savings for subscriptions the user marked as cancellation
 * candidates. Grouped per currency; the UI must label this as an estimate
 * derived from the recurring amount, not money already saved.
 */
export function potentialSavingsByCurrency(subs: Subscription[]): CurrencyAmount[] {
  const totals = new Map<CurrencyCode, number>();
  for (const sub of subs) {
    if (!sub.isCancelCandidate || sub.status === 'canceled' || sub.archivedAt) continue;
    totals.set(
      sub.currency,
      (totals.get(sub.currency) ?? 0) + monthlyEquivalentCents(sub.amountCents, sub.interval),
    );
  }
  return toSortedAmounts(totals);
}

/** Billing frequency label shown on rows/details, e.g. "monthly", "every 3 weeks". */
export function intervalLabel(interval: BillingIntervalValue): string {
  const preset = intervalToPresetKey(interval);
  if (preset !== 'custom') {
    return INTERVAL_PRESETS.find((p) => p.key === preset)!.label;
  }
  const unitWord = { day: 'day', week: 'week', month: 'month', year: 'year' }[interval.unit];
  return interval.every === 1 ? `Every ${unitWord}` : `Every ${interval.every} ${unitWord}s`;
}

/** Detect a price increase by comparing current amount to price history. */
export function latestPriceChange(sub: Subscription): { fromCents: number; toCents: number } | null {
  if (sub.priceHistory.length === 0) return null;
  const sorted = [...sub.priceHistory].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const last = sorted[sorted.length - 1];
  if (last.currency !== sub.currency || last.amountCents === sub.amountCents) return null;
  return { fromCents: last.amountCents, toCents: sub.amountCents };
}
