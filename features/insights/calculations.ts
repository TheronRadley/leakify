/**
 * Insight calculations built purely from stored subscription data.
 * Nothing here is fabricated: if data does not support an insight, none is
 * produced (screens render their empty states instead).
 */
import {
  annualProjectionByCurrency,
  contributesToRecurringSpend,
  monthlyEquivalentCents,
  monthlyRecurringByCurrency,
  potentialSavingsByCurrency,
  spendByCategory,
} from '@/lib/billing';
import { daysBetween } from '@/lib/dates';
import type { BillingEvent, CurrencyCode, Subscription } from '@/types';

export interface InsightsSummary {
  monthly: { currency: CurrencyCode; amountCents: number }[];
  annual: { currency: CurrencyCode; amountCents: number }[];
  potentialSavings: { currency: CurrencyCode; amountCents: number }[];
  categorySpend: ReturnType<typeof spendByCategory>;
  largest: Subscription[];
  upcomingClusters: RenewalCluster[];
  trialsEnding: Subscription[];
  hasEnoughData: boolean;
}

export interface RenewalCluster {
  /** "Oct 14 – Oct 20" style week window. */
  label: string;
  startISO: string;
  endISO: string;
  count: number;
  totals: { currency: CurrencyCode; amountCents: number }[];
}

export function computeInsights(subs: Subscription[], refISO: string): InsightsSummary {
  const live = subs.filter(contributesToRecurringSpend);
  const monthly = monthlyRecurringByCurrency(subs);
  const annual = annualProjectionByCurrency(subs);
  const categorySpend = spendByCategory(subs);
  const largest = [...live]
    .sort(
      (a, b) =>
        monthlyEquivalentCents(b.amountCents, b.interval) -
        monthlyEquivalentCents(a.amountCents, a.interval),
    )
    .slice(0, 5);

  return {
    monthly,
    annual,
    potentialSavings: potentialSavingsByCurrency(subs),
    categorySpend,
    largest,
    upcomingClusters: computeRenewalClusters(live, refISO),
    trialsEnding: live
      .filter((s) => {
        if (!s.trialEndDate) return false;
        const days = daysBetween(refISO, s.trialEndDate);
        return days !== null && days >= 0 && days <= 14;
      })
      .sort((a, b) => a.trialEndDate!.localeCompare(b.trialEndDate!)),
    hasEnoughData: live.length > 0,
  };
}

/**
 * Group upcoming renewals (next 30 days) into 7-day windows so users can see
 * expensive weeks coming, e.g. "3 renewals between Oct 14 – Oct 20".
 */
export function computeRenewalClusters(live: Subscription[], refISO: string): RenewalCluster[] {
  const windows: RenewalCluster[] = [];
  for (let w = 0; w < 4; w += 1) {
    const startOffset = w * 7;
    const endOffset = startOffset + 6;
    const start = offsetISO(refISO, startOffset);
    const end = offsetISO(refISO, endOffset);
    const charges = live.filter((s) => {
      if (!s.nextBillingDate) return false;
      const days = daysBetween(refISO, s.nextBillingDate);
      return days !== null && days >= startOffset && days <= endOffset;
    });
    if (charges.length === 0) continue;
    const totals = new Map<CurrencyCode, number>();
    for (const c of charges) totals.set(c.currency, (totals.get(c.currency) ?? 0) + c.amountCents);
    windows.push({
      label: `${shortLabel(start)} – ${shortLabel(end)}`,
      startISO: start,
      endISO: end,
      count: charges.length,
      totals: [...totals.entries()].map(([currency, amountCents]) => ({ currency, amountCents })),
    });
  }
  return windows;
}

function offsetISO(refISO: string, days: number): string {
  const d = new Date(refISO + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function shortLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

export interface TrendPoint {
  /** "2026-10" */
  key: string;
  label: string;
  totals: { currency: CurrencyCode; amountCents: number }[];
  count: number;
}

/**
 * Historical spending trend from RECORDED billing events only (payments the
 * user actually confirmed) — never fabricates a trend from schedules.
 * Groups charged amounts per calendar month, currencies separated.
 */
export function computeSpendTrend(events: BillingEvent[], refISO: string, months = 6): TrendPoint[] {
  const [ry, rm] = refISO.split('-').map((v) => parseInt(v, 10));
  const buckets: TrendPoint[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(ry, rm - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({
      key,
      label: monthsShort(d.getMonth()),
      totals: [],
      count: 0,
    });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));

  for (const event of events) {
    if (event.status !== 'charged') continue;
    const dateISO = event.actualDate ?? event.expectedDate;
    const key = dateISO.slice(0, 7);
    const bucket = byKey.get(key);
    if (!bucket) continue;
    bucket.count += 1;
    const amount = event.actualAmountCents ?? event.amountCents;
    const existing = bucket.totals.find((t) => t.currency === event.currency);
    if (existing) existing.amountCents += amount;
    else bucket.totals.push({ currency: event.currency, amountCents: amount });
  }
  return buckets;
}

function monthsShort(monthIndex: number): string {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][monthIndex];
}
