import { computeInsights, computeRenewalClusters, computeSpendTrend } from '@/features/insights/calculations';
import type { BillingEvent, Subscription } from '@/types';

const REF = '2026-10-10';

function sub(partial: Partial<Subscription>): Subscription {
  return {
    id: Math.random().toString(36).slice(2),
    userId: 'user',
    name: 'Service',
    provider: null,
    category: 'other',
    amountCents: 1000,
    currency: 'USD',
    interval: { every: 1, unit: 'month' },
    startDate: '2026-01-01',
    nextBillingDate: null,
    trialEndDate: null,
    status: 'active',
    paymentMethodLabel: null,
    cancellationUrl: null,
    cancellationNotes: null,
    notes: null,
    reminders: { enabled: true, renewalLeadDays: [], trialLeadDays: [] },
    flaggedUnused: false,
    isCancelCandidate: false,
    canceledAt: null,
    archivedAt: null,
    priceHistory: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

function event(partial: Partial<BillingEvent>): BillingEvent {
  return {
    id: Math.random().toString(36).slice(2),
    subscriptionId: 's1',
    userId: 'user',
    expectedDate: '2026-10-01',
    amountCents: 1549,
    currency: 'USD',
    type: 'renewal',
    status: 'charged',
    actualDate: null,
    actualAmountCents: null,
    createdAt: '2026-10-01T00:00:00Z',
    ...partial,
  };
}

describe('computeInsights', () => {
  it('reports hasEnoughData=false with no live subscriptions', () => {
    const insights = computeInsights([], REF);
    expect(insights.hasEnoughData).toBe(false);
    expect(insights.monthly).toEqual([]);
  });

  it('ranks the largest subscriptions by monthly equivalent', () => {
    const insights = computeInsights(
      [sub({ name: 'Cheap', amountCents: 100 }), sub({ name: 'Pricey', amountCents: 20000 })],
      REF,
    );
    expect(insights.largest[0].name).toBe('Pricey');
  });

  it('counts potential savings only from user-flagged candidates', () => {
    const insights = computeInsights(
      [
        sub({ name: 'Flagged', amountCents: 1200, isCancelCandidate: true }),
        sub({ name: 'NotFlagged', amountCents: 1200 }),
      ],
      REF,
    );
    expect(insights.potentialSavings).toEqual([{ currency: 'USD', amountCents: 1200 }]);
  });
});

describe('computeRenewalClusters', () => {
  it('groups renewals into 7-day windows with counts and totals', () => {
    const clusters = computeRenewalClusters(
      [
        sub({ nextBillingDate: '2026-10-11', amountCents: 1000 }),
        sub({ nextBillingDate: '2026-10-13', amountCents: 2000 }),
        sub({ nextBillingDate: '2026-10-25', amountCents: 5000 }),
        sub({ nextBillingDate: '2026-12-01', amountCents: 9000 }), // beyond 4 weeks
      ],
      REF,
    );
    expect(clusters).toHaveLength(2);
    expect(clusters[0].count).toBe(2);
    expect(clusters[0].totals).toEqual([{ currency: 'USD', amountCents: 3000 }]);
    expect(clusters[1].count).toBe(1);
  });

  it('returns empty when nothing renews soon', () => {
    expect(computeRenewalClusters([sub({ nextBillingDate: null })], REF)).toEqual([]);
  });
});

describe('computeSpendTrend — only recorded payments count', () => {
  it('builds monthly buckets from charged events, currencies separated', () => {
    const trend = computeSpendTrend(
      [
        event({ expectedDate: '2026-10-05', amountCents: 1549 }),
        event({ expectedDate: '2026-10-07', amountCents: 299 }),
        event({ expectedDate: '2026-09-11', amountCents: 990, currency: 'EUR' }),
        event({ expectedDate: '2026-08-11', amountCents: 9999, status: 'expected' }), // not charged — excluded
        event({ expectedDate: '2026-03-01', amountCents: 5000 }), // older than 6 months
      ],
      REF,
    );
    const oct = trend.find((t) => t.key === '2026-10')!;
    expect(oct.count).toBe(2);
    expect(oct.totals).toContainEqual({ currency: 'USD', amountCents: 1848 });
    const sep = trend.find((t) => t.key === '2026-09')!;
    expect(sep.totals).toEqual([{ currency: 'EUR', amountCents: 990 }]);
    const aug = trend.find((t) => t.key === '2026-08')!;
    expect(aug.totals).toEqual([]);
    expect(trend.find((t) => t.key === '2026-03')).toBeUndefined();
  });

  it('returns empty buckets when there is no history', () => {
    const trend = computeSpendTrend([], REF);
    expect(trend).toHaveLength(6);
    expect(trend.every((t) => t.count === 0)).toBe(true);
  });
});
