import {
  buildMonthGrid,
  chargesOnDate,
  cursorFor,
  shiftMonth,
  totalsForDay,
} from '@/features/calendar/utils';
import type { Subscription } from '@/types';

function sub(partial: Partial<Subscription>): Subscription {
  return {
    id: 's1',
    userId: 'user',
    name: 'Sub',
    provider: null,
    category: 'other',
    amountCents: 1000,
    currency: 'USD',
    interval: { every: 1, unit: 'month' },
    startDate: '2026-01-01',
    nextBillingDate: '2026-01-15',
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

describe('buildMonthGrid', () => {
  it('always returns 42 cells covering the month', () => {
    const grid = buildMonthGrid(2026, 9, 1, new Date(2026, 9, 10)); // October 2026
    expect(grid).toHaveLength(42);
    expect(grid.filter((c) => c.inCurrentMonth)).toHaveLength(31);
    expect(grid.find((c) => c.dateISO === '2026-10-10')?.isToday).toBe(true);
    expect(grid[0].dateISO).toBe('2026-09-28'); // Monday preceding Oct 1 (Thursday)
  });

  it('marks today only once', () => {
    const grid = buildMonthGrid(2026, 9, 1, new Date(2026, 9, 10));
    expect(grid.filter((c) => c.isToday)).toHaveLength(1);
  });
});

describe('shiftMonth', () => {
  it('crosses year boundaries', () => {
    expect(shiftMonth({ year: 2026, monthIndex: 11 }, 1)).toEqual({ year: 2027, monthIndex: 0 });
    expect(shiftMonth({ year: 2026, monthIndex: 0 }, -1)).toEqual({ year: 2025, monthIndex: 11 });
  });
});

describe('chargesOnDate', () => {
  it('returns recurring renewals anchored on the 15th', () => {
    const subs = [sub({})];
    expect(chargesOnDate(subs, '2026-10-15')).toHaveLength(1);
    expect(chargesOnDate(subs, '2026-10-14')).toHaveLength(0);
  });

  it('handles 31st anchors across short months', () => {
    const subs = [sub({ nextBillingDate: '2026-01-31' })];
    expect(chargesOnDate(subs, '2026-03-31')[0]?.type).toBe('renewal');
    expect(chargesOnDate(subs, '2026-04-30')[0]?.type).toBe('renewal');
    expect(chargesOnDate(subs, '2026-04-31')).toHaveLength(0);
  });

  it('handles yearly Feb 29 schedules on Feb 28 in common years', () => {
    const subs = [sub({ nextBillingDate: '2024-02-29', interval: { every: 1, unit: 'year' } })];
    expect(chargesOnDate(subs, '2026-02-28')[0]?.type).toBe('renewal');
    expect(chargesOnDate(subs, '2028-02-29')[0]?.type).toBe('renewal');
  });

  it('distinguishes trial deadlines from renewals', () => {
    const subs = [sub({ status: 'trialing', trialEndDate: '2026-10-11', nextBillingDate: '2026-10-15' })];
    const charges = chargesOnDate(subs, '2026-10-11');
    expect(charges).toHaveLength(1);
    expect(charges[0].type).toBe('trial_end');
  });

  it('week-before-anchor dates show nothing (no false positives)', () => {
    const subs = [sub({ nextBillingDate: '2026-01-31' })];
    expect(chargesOnDate(subs, '2026-01-30')).toHaveLength(0);
  });
});

describe('totalsForDay', () => {
  it('sums per currency, excluding trial-deadline pseudo charges', () => {
    const dayCharges = chargesOnDate(
      [
        sub({ id: 'a', amountCents: 1000, nextBillingDate: '2026-10-15' }),
        sub({ id: 'b', amountCents: 2000, currency: 'EUR', nextBillingDate: '2026-10-15' }),
        sub({ id: 'c', status: 'trialing', trialEndDate: '2026-10-15', nextBillingDate: '2026-11-01', amountCents: 5000 }),
      ],
      '2026-10-15',
    );
    const totals = totalsForDay(dayCharges);
    expect(totals).toEqual([
      { currency: 'EUR', amountCents: 2000 },
      { currency: 'USD', amountCents: 1000 },
    ]);
  });

  it('cursorFor returns the month of a date', () => {
    expect(cursorFor(new Date(2026, 9, 10))).toEqual({ year: 2026, monthIndex: 9 });
  });
});
