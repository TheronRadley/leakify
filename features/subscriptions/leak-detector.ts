/**
 * Leak detector: turns actually-stored data into reviewable findings.
 *
 * Rules honored here:
 * - Duplicates are *candidates* for review, derived from name/provider
 *   similarity, same category, and overlapping billing schedules. The app
 *   never claims it knows which services a user stopped using by itself;
 *   unused-subscription findings require the user-supplied flag.
 * - Findings explain WHY each item is flagged.
 */
import { monthlyEquivalentCents } from '@/lib/billing';
import { daysBetween } from '@/lib/dates';
import { formatMoney } from '@/lib/currency';
import { categoryLabel } from '@/lib/constants';
import type { LeakFinding, Subscription } from '@/types';

/** Normalize a name for fuzzy comparison (lowercase, alphanumerics only). */
export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeName(value).split(' ').filter(Boolean));
}

/** Dice-coefficient bigram similarity on normalized names, 0..1. */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a).replace(/ /g, '');
  const nb = normalizeName(b).replace(/ /g, '');
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i += 1) set.add(s.slice(i, i + 2));
    return set;
  };
  const A = bigrams(na);
  const B = bigrams(nb);
  if (A.size === 0 || B.size === 0) return 0;
  let overlap = 0;
  for (const g of A) if (B.has(g)) overlap += 1;
  return (2 * overlap) / (A.size + B.size);
}

function shareSignificantToken(a: string, b: string): boolean {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  for (const t of ta) {
    if (t.length >= 4 && tb.has(t)) return true;
  }
  return false;
}

export interface DuplicateCandidate {
  a: Subscription;
  b: Subscription;
  score: number;
  reasons: string[];
}

/**
 * Find duplicate candidates among live subscriptions. Score combines name
 * similarity, shared provider tokens, same category and matching intervals.
 */
export function findDuplicateCandidates(subs: Subscription[]): DuplicateCandidate[] {
  const live = subs.filter(
    (s) => !s.archivedAt && s.status !== 'canceled' && s.status !== 'paused',
  );
  const candidates: DuplicateCandidate[] = [];

  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const a = live[i];
      const b = live[j];
      const reasons: string[] = [];
      let score = 0;

      const sim = nameSimilarity(a.name, b.name);
      if (sim >= 0.9) {
        score += 0.55;
        reasons.push('Very similar names');
      } else if (sim >= 0.55 || shareSignificantToken(a.name, b.name)) {
        score += 0.3;
        reasons.push('Similar names');
      }

      if (a.provider && b.provider && shareSignificantToken(a.provider, b.provider)) {
        score += 0.25;
        reasons.push(`Same provider (${a.provider})`);
      }
      if (a.category === b.category) {
        score += 0.15;
        reasons.push(`Both in ${categoryLabel(a.category)}`);
      }
      if (a.interval.every === b.interval.every && a.interval.unit === b.interval.unit) {
        score += 0.1;
      }
      if (
        a.nextBillingDate &&
        b.nextBillingDate &&
        (daysBetween(a.nextBillingDate, b.nextBillingDate) ?? 99) === 0
      ) {
        score += 0.1;
        reasons.push('Same billing date');
      }

      // Duplicate requires real name/provider overlap — category alone is not enough.
      const hasIdentityOverlap = sim >= 0.55 || shareSignificantToken(a.name, b.name)
        || (a.provider && b.provider && shareSignificantToken(a.provider, b.provider));
      if (hasIdentityOverlap && score >= 0.45) {
        candidates.push({ a, b, score: Math.min(1, score), reasons });
      }
    }
  }
  return candidates.sort((x, y) => y.score - x.score);
}

export interface LeakDetectorInput {
  subscriptions: Subscription[];
  /** Reference "today" ISO date for trial/upcoming calculations. */
  refISO: string;
  /** Sums of charges expected within 7 days, grouped per currency (see lib/billing). */
  upcoming7dTotals: { currency: string; amountCents: number }[];
}

export function detectLeaks(input: LeakDetectorInput): LeakFinding[] {
  const { subscriptions, refISO } = input;
  const findings: LeakFinding[] = [];
  const live = subscriptions.filter(
    (s) => !s.archivedAt && (s.status === 'active' || s.status === 'trialing'),
  );

  // Trials ending within 7 days.
  for (const sub of live) {
    if (sub.status !== 'trialing' || !sub.trialEndDate) continue;
    const days = daysBetween(refISO, sub.trialEndDate);
    if (days !== null && days >= 0 && days <= 7) {
      findings.push({
        id: `trial_${sub.id}`,
        kind: 'trial_ending',
        subscriptionIds: [sub.id],
        title: `${sub.name} free trial ${days === 0 ? 'ends today' : days === 1 ? 'ends tomorrow' : `ends in ${days} days`}`,
        explanation:
          'Free trials convert to paid plans automatically. Review this trial before the deadline to avoid being charged.',
        severity: days <= 2 ? 'urgent' : 'warning',
      });
    }
  }

  // Duplicates.
  for (const dup of findDuplicateCandidates(subscriptions)) {
    findings.push({
      id: `dup_${dup.a.id}_${dup.b.id}`,
      kind: 'duplicate_candidate',
      subscriptionIds: [dup.a.id, dup.b.id],
      title: `Possible duplicate: ${dup.a.name} and ${dup.b.name}`,
      explanation: `These look like they may bill for the same service (${dup.reasons.join(', ')}). Review both — this is a candidate, not a confirmation.`,
      severity: 'warning',
      estimatedMonthlyCents: [
        { currency: dup.b.currency, amountCents: monthlyEquivalentCents(dup.b.amountCents, dup.b.interval) },
      ],
    });
  }

  // Missing billing dates.
  for (const sub of live) {
    if (sub.nextBillingDate) continue;
    findings.push({
      id: `missing_date_${sub.id}`,
      kind: 'missing_billing_date',
      subscriptionIds: [sub.id],
      title: `${sub.name} has no next billing date`,
      explanation:
        'Leakify cannot schedule reminders or forecast charges without a billing date. Edit the subscription to add one.',
      severity: 'info',
    });
  }

  // User-flagged unused.
  for (const sub of live) {
    if (!sub.flaggedUnused) continue;
    findings.push({
      id: `unused_${sub.id}`,
      kind: 'flagged_unused',
      subscriptionIds: [sub.id],
      title: `You marked ${sub.name} as unused`,
      explanation: `You flagged this subscription as no longer used. If that is still true, cancelling could save about ${formatMoney(
        monthlyEquivalentCents(sub.amountCents, sub.interval),
        sub.currency,
      )}/month.`,
      severity: 'warning',
      estimatedMonthlyCents: [
        { currency: sub.currency, amountCents: monthlyEquivalentCents(sub.amountCents, sub.interval) },
      ],
    });
  }

  // Large upcoming 7-day total (>= threshold within any single currency).
  for (const t of input.upcoming7dTotals) {
    if (t.amountCents >= largeWeekThreshold(t.currency)) {
      findings.push({
        id: `big_week_${t.currency}`,
        kind: 'large_upcoming_total',
        subscriptionIds: [],
        title: `${formatMoney(t.amountCents, t.currency)} in charges within 7 days`,
        explanation:
          'Several renewals land in the next week. Review the upcoming list so none of them surprise you.',
        severity: 'info',
      });
    }
  }

  // Price increases from user-recorded history.
  for (const sub of live) {
    if (sub.priceHistory.length === 0) continue;
    const last = [...sub.priceHistory].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)).at(-1);
    if (!last || last.currency !== sub.currency || last.amountCents >= sub.amountCents) continue;
    findings.push({
      id: `price_up_${sub.id}`,
      kind: 'price_increase',
      subscriptionIds: [sub.id],
      title: `${sub.name} price increased`,
      explanation: `Your records show it went from ${formatMoney(last.amountCents, sub.currency)} to ${formatMoney(
        sub.amountCents,
        sub.currency,
      )}. Decide whether it is still worth it at the new price.`,
      severity: 'info',
    });
  }

  const order = { urgent: 0, warning: 1, info: 2 };
  return findings.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** Rough per-currency "large week" thresholds (in minor units). */
function largeWeekThreshold(currency: string): number {
  switch (currency) {
    case 'JPY':
    case 'KRW':
      return 1_500_000; // ¥15,000 / ₩15,000
    case 'INR':
      return 800_000; // ₹8,000
    default:
      return 10_000; // 100.00
  }
}
