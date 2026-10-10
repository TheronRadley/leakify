import {
  computeDigestPlan,
  computeReminderPlans,
  diffScheduledNotifications,
  isReminderEligible,
  MAX_SCHEDULED_NOTIFICATIONS,
} from '@/features/notifications/engine';
import type { ScheduledNotification, Subscription } from '@/types';

const NOW = '2026-10-10T12:00:00'; // a Saturday, local noon

function sub(partial: Partial<Subscription>): Subscription {
  return {
    id: 's1',
    userId: 'user',
    name: 'Netflix',
    provider: null,
    category: 'streaming',
    amountCents: 1549,
    currency: 'USD',
    interval: { every: 1, unit: 'month' },
    startDate: '2026-01-01',
    nextBillingDate: '2026-10-13',
    trialEndDate: null,
    status: 'active',
    paymentMethodLabel: null,
    cancellationUrl: null,
    cancellationNotes: null,
    notes: null,
    reminders: { enabled: true, renewalLeadDays: [3, 1, 0], trialLeadDays: [1] },
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

describe('isReminderEligible', () => {
  it('never notifies for canceled, paused or archived subscriptions', () => {
    expect(isReminderEligible(sub({ status: 'canceled' }))).toBe(false);
    expect(isReminderEligible(sub({ status: 'paused' }))).toBe(false);
    expect(isReminderEligible(sub({ archivedAt: '2026-01-01T00:00:00Z' }))).toBe(false);
    expect(isReminderEligible(sub({ reminders: { enabled: false, renewalLeadDays: [3], trialLeadDays: [] } }))).toBe(false);
  });
  it('notifies for active and trialing ones', () => {
    expect(isReminderEligible(sub({}))).toBe(true);
    expect(isReminderEligible(sub({ status: 'trialing', trialEndDate: '2026-10-11' }))).toBe(true);
  });
});

describe('computeReminderPlans', () => {
  it('schedules renewal reminders at each configured lead time', () => {
    // At 6 AM all leads [3, 1, 0] are still in the future.
    const morning = computeReminderPlans([sub({})], { nowISO: '2026-10-10T06:00:00', horizonDays: 10 });
    const morningLeads = morning
      .filter((p) => p.type === 'renewal' && p.occurrenceDate === '2026-10-13')
      .map((p) => p.leadDays);
    expect(morningLeads).toEqual([3, 1, 0]);

    // At noon the 3-day lead (would have fired 9 AM today) is correctly dropped
    // — past triggers are never scheduled.
    const noon = computeReminderPlans([sub({})], { nowISO: NOW, horizonDays: 10 });
    const noonLeads = noon
      .filter((p) => p.type === 'renewal' && p.occurrenceDate === '2026-10-13')
      .map((p) => p.leadDays);
    expect(noonLeads).toEqual([1, 0]);
  });

  it('uses the actual saved name, amount and currency in the copy', () => {
    const plans = computeReminderPlans([sub({})], { nowISO: '2026-10-10T06:00:00', horizonDays: 10 });
    const threeDay = plans.find((p) => p.leadDays === 3 && p.occurrenceDate === '2026-10-13')!;
    expect(threeDay.title).toContain('Netflix');
    expect(threeDay.title).toContain('$15.49');
    const sameDay = plans.find((p) => p.leadDays === 0 && p.occurrenceDate === '2026-10-13')!;
    expect(sameDay.title).toBe('Netflix bills today — $15.49');
  });

  it('creates dedup-stable keys across recomputation', () => {
    const a = computeReminderPlans([sub({})], { nowISO: '2026-10-11T06:00:00', horizonDays: 5 });
    const b = computeReminderPlans([sub({ name: 'Netflix Standard' })], { nowISO: '2026-10-11T06:00:00', horizonDays: 5 });
    // Renaming the subscription does not change reminder identity.
    expect(a.map((p) => p.key)).toEqual(b.map((p) => p.key));
  });

  it('schedules trial reminders with lead times', () => {
    const plans = computeReminderPlans(
      [sub({ status: 'trialing', trialEndDate: '2026-10-11', nextBillingDate: '2026-10-11' })],
      { nowISO: '2026-10-10T06:00:00', horizonDays: 10 },
    );
    const trial = plans.find((p) => p.type === 'trial')!;
    expect(trial.title).toBe('Your Netflix free trial ends tomorrow');
    expect(trial.body).toContain('before you are charged');
  });

  it('drops past-dated trials and billing dates gracefully', () => {
    const plans = computeReminderPlans(
      [sub({ status: 'trialing', trialEndDate: '2026-10-01', nextBillingDate: '2026-10-01' })],
      { nowISO: NOW, horizonDays: 10 },
    );
    expect(plans).toHaveLength(0);
  });

  it('pre-schedules recurring occurrences inside the horizon', () => {
    const weekly = sub({ interval: { every: 1, unit: 'week' }, nextBillingDate: '2026-10-12' });
    const plans = computeReminderPlans([weekly], { nowISO: '2026-10-10T06:00:00', horizonDays: 21 });
    const occurrences = [...new Set(plans.filter((p) => p.type === 'renewal').map((p) => p.occurrenceDate))];
    expect(occurrences).toEqual(['2026-10-12', '2026-10-19', '2026-10-26']);
  });

  it('respects the platform cap keeping soonest notifications first', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      sub({ id: `s${i}`, name: `Service ${i}`, nextBillingDate: `2026-10-${String(10 + (i % 18) + 1).padStart(2, '0')}` }),
    );
    const plans = computeReminderPlans(many, { nowISO: '2026-10-10T00:30:00', horizonDays: 30 });
    expect(plans.length).toBeLessThanOrEqual(MAX_SCHEDULED_NOTIFICATIONS);
    const triggers = plans.map((p) => p.triggerAt);
    const sorted = [...triggers].sort();
    expect(triggers).toEqual(sorted); // soonest first
  });

  it('month-end monthly schedule lands on valid dates across leap Feb', () => {
    const monthly = sub({ interval: { every: 1, unit: 'month' }, nextBillingDate: '2027-01-31', reminders: { enabled: true, renewalLeadDays: [0], trialLeadDays: [] } });
    const plans = computeReminderPlans([monthly], { nowISO: '2027-01-30T06:00:00', horizonDays: 60 });
    const occurrences = plans.map((p) => p.occurrenceDate);
    expect(occurrences).toContain('2027-01-31');
    expect(occurrences).toContain('2027-02-28'); // clamped
    expect(occurrences).toContain('2027-03-31'); // anchor day preserved
  });
});

describe('diffScheduledNotifications — dedup across edits', () => {
  const existingRecord = (key: string, osId: string): ScheduledNotification => ({
    key,
    subscriptionId: 's1',
    type: 'renewal',
    occurrenceDate: '2026-10-13',
    leadDays: 1,
    triggerAt: '2026-10-12T09:00:00',
    osNotificationId: osId,
    status: 'scheduled',
    createdAt: '2026-10-10T00:00:00Z',
  });

  it('keeps identical reminders instead of rescheduling', () => {
    const plans = computeReminderPlans([sub({})], { nowISO: '2026-10-12T06:00:00', horizonDays: 3 });
    const existing = plans.map((p) => existingRecord(p.key, `os-${p.key}`));
    const diff = diffScheduledNotifications(plans, existing);
    expect(diff.toSchedule).toHaveLength(0);
    expect(diff.toCancel).toHaveLength(0);
  });

  it('cancels obsolete reminders and schedules new ones', () => {
    // Subscription moved to next month -> old reminders must cancel.
    const existing = [
      existingRecord('s1:2026-10-13:renewal:1', 'os-old-1'),
      existingRecord('s1:2026-10-13:renewal:0', 'os-old-0'),
    ];
    const plans = computeReminderPlans([sub({ nextBillingDate: '2026-11-13' })], { nowISO: '2026-10-12T06:00:00', horizonDays: 40 });
    const diff = diffScheduledNotifications(plans, existing);
    expect(diff.toCancel.map((c) => c.key).sort()).toEqual([
      's1:2026-10-13:renewal:0',
      's1:2026-10-13:renewal:1',
    ]);
    expect(diff.toSchedule.length).toBeGreaterThan(0);
    const newRenewals = diff.toSchedule.filter((p): p is import('@/features/notifications/engine').ReminderPlan => 'occurrenceDate' in p);
    expect(newRenewals.every((p) => p.occurrenceDate !== '2026-10-13')).toBe(true);
  });

  it('canceling a subscription removes all of its reminders', () => {
    const live = computeReminderPlans([sub({})], { nowISO: '2026-10-12T06:00:00', horizonDays: 3 });
    const existing = live.map((p) => existingRecord(p.key, `os-${p.key}`));
    const canceledPlans = computeReminderPlans([sub({ status: 'canceled' })], { nowISO: '2026-10-12T06:00:00', horizonDays: 3 });
    const diff = diffScheduledNotifications(canceledPlans, existing);
    expect(diff.toCancel).toHaveLength(existing.length);
    expect(diff.toSchedule).toHaveLength(0);
  });

  it('repeated identical syncs are a no-op (no duplicates)', () => {
    const plans = computeReminderPlans([sub({})], { nowISO: '2026-10-11T06:00:00', horizonDays: 5 });
    let existing: ScheduledNotification[] = [];
    for (let i = 0; i < 3; i += 1) {
      const diff = diffScheduledNotifications(plans, existing);
      existing = [
        ...existing.filter((e) => !diff.toCancel.includes(e)),
        ...diff.toSchedule.map((p) => existingRecord(p.key, `os-${p.key}`)),
      ];
    }
    expect(existing).toHaveLength(plans.length);
    expect(new Set(existing.map((e) => e.key)).size).toBe(plans.length);
  });
});

describe('computeDigestPlan', () => {
  it('summarizes the coming week when charges exist', () => {
    const digest = computeDigestPlan(
      [sub({ id: 'a', nextBillingDate: '2026-10-14' }), sub({ id: 'b', nextBillingDate: '2026-10-16' })],
      { nowISO: '2026-10-10T10:00:00' },
    );
    expect(digest).not.toBeNull();
    expect(digest!.title).toContain('2 subscription payments');
  });

  it('returns null when nothing is due next week', () => {
    expect(computeDigestPlan([sub({ nextBillingDate: '2026-12-01' })], { nowISO: '2026-10-10T10:00:00' })).toBeNull();
  });
});
