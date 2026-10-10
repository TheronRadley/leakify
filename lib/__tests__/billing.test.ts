import {
  annualEquivalentCents,
  annualProjectionByCurrency,
  intervalLabel,
  monthlyEquivalentCents,
  monthlyRecurringByCurrency,
  spendByCategory,
  upcomingChargesByCurrency,
} from '@/lib/billing';
import type { Subscription } from '@/types';

function sub(partial: Partial<Subscription>): Subscription {
  return {
    id: 'id',
    userId: 'user',
    name: 'Sub',
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
    reminders: { enabled: true, renewalLeadDays: [3, 1], trialLeadDays: [] },
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

describe('monthlyEquivalentCents — all billing intervals', () => {
  it('weekly: $10/week => $43.33/month (52/12)', () => {
    expect(monthlyEquivalentCents(1000, { every: 1, unit: 'week' })).toBe(4333);
  });
  it('monthly: identity', () => {
    expect(monthlyEquivalentCents(1549, { every: 1, unit: 'month' })).toBe(1549);
  });
  it('quarterly: $60/3mo => $20/mo', () => {
    expect(monthlyEquivalentCents(6000, { every: 3, unit: 'month' })).toBe(2000);
  });
  it('semiannual: $90/6mo => $15/mo', () => {
    expect(monthlyEquivalentCents(9000, { every: 6, unit: 'month' })).toBe(1500);
  });
  it('yearly: $120/yr => $10/mo', () => {
    expect(monthlyEquivalentCents(12000, { every: 1, unit: 'year' })).toBe(1000);
  });
  it('custom every 2 months: $50/2mo => $25/mo', () => {
    expect(monthlyEquivalentCents(5000, { every: 2, unit: 'month' })).toBe(2500);
  });
  it('custom every 6 weeks: $42 => $30.33/mo', () => {
    expect(monthlyEquivalentCents(4200, { every: 6, unit: 'week' })).toBe(3033);
  });
  it('custom every 30 days: $30 => $30.42/mo', () => {
    expect(monthlyEquivalentCents(3000, { every: 30, unit: 'day' })).toBe(3042);
  });
});

describe('annualEquivalentCents', () => {
  it('annual projection is exactly 12 months of monthly equivalent', () => {
    const monthly = monthlyEquivalentCents(1000, { every: 1, unit: 'week' });
    expect(annualEquivalentCents(1000, { every: 1, unit: 'week' })).toBe(monthly * 12);
  });
});

describe('currency separation', () => {
  it('never mixes USD and EUR totals', () => {
    const subs = [
      sub({ id: 'a', amountCents: 1000, currency: 'USD' }),
      sub({ id: 'b', amountCents: 2000, currency: 'EUR' }),
    ];
    const monthly = monthlyRecurringByCurrency(subs);
    expect(monthly).toEqual([
      { currency: 'EUR', amountCents: 2000 },
      { currency: 'USD', amountCents: 1000 },
    ]);
    const annual = annualProjectionByCurrency(subs);
    expect(annual.find((a) => a.currency === 'USD')?.amountCents).toBe(12000);
  });
});

describe('status filtering', () => {
  it('paused, canceled and archived subscriptions do not count toward spend', () => {
    const subs = [
      sub({ id: 'active', amountCents: 1000 }),
      sub({ id: 'paused', amountCents: 5000, status: 'paused' }),
      sub({ id: 'canceled', amountCents: 9000, status: 'canceled', canceledAt: '2026-01-01T00:00:00Z' }),
      sub({ id: 'archived', amountCents: 9000, archivedAt: '2026-01-01T00:00:00Z' }),
      sub({ id: 'trialing', amountCents: 1500, status: 'trialing' }),
    ];
    expect(monthlyRecurringByCurrency(subs)).toEqual([
      { currency: 'USD', amountCents: 2500 },
    ]);
  });
});

describe('upcomingChargesByCurrency', () => {
  it('sums only charges due within the window', () => {
    const subs = [
      sub({ id: 'a', amountCents: 1000, nextBillingDate: '2026-10-12' }), // 2 days
      sub({ id: 'b', amountCents: 2000, nextBillingDate: '2026-10-17' }), // 7 days (inclusive)
      sub({ id: 'c', amountCents: 5000, nextBillingDate: '2026-10-25' }), // out of window
      sub({ id: 'd', amountCents: 9000, nextBillingDate: '2026-10-09' }), // past
      sub({ id: 'e', amountCents: 9000, nextBillingDate: null }), // no date
    ];
    expect(upcomingChargesByCurrency(subs, '2026-10-10', 7)).toEqual([
      { currency: 'USD', amountCents: 3000 },
    ]);
  });

  it('handles invalid dates gracefully', () => {
    const subs = [sub({ id: 'a', nextBillingDate: 'garbage' })];
    expect(upcomingChargesByCurrency(subs, '2026-10-10', 7)).toEqual([]);
  });
});

describe('spendByCategory', () => {
  it('groups monthly spend per category with per-currency buckets', () => {
    const subs = [
      sub({ id: 'a', category: 'streaming', amountCents: 1000 }),
      sub({ id: 'b', category: 'streaming', amountCents: 500 }),
      sub({ id: 'c', category: 'software', amountCents: 4000, currency: 'EUR' }),
    ];
    const result = spendByCategory(subs);
    expect(result).toHaveLength(2);
    const streaming = result.find((c) => c.category === 'streaming')!;
    expect(streaming.totalCentsInCurrency('USD')).toBe(1500);
    const software = result.find((c) => c.category === 'software')!;
    expect(software.totalCentsInCurrency('EUR')).toBe(4000);
    expect(software.totalCentsInCurrency('USD')).toBe(0);
  });
});

describe('intervalLabel', () => {
  it('renders preset and custom labels', () => {
    expect(intervalLabel({ every: 1, unit: 'month' })).toBe('Monthly');
    expect(intervalLabel({ every: 3, unit: 'month' })).toBe('Every 3 months');
    expect(intervalLabel({ every: 2, unit: 'week' })).toBe('Every 2 weeks');
    expect(intervalLabel({ every: 1, unit: 'year' })).toBe('Yearly');
  });
});
