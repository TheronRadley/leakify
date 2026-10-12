/**
 * Lock-screen privacy mode (audit S-07).
 *
 * The point of the setting is that a notification visible on a locked device
 * must not reveal WHAT you subscribe to or HOW MUCH you pay. So the assertions
 * here are about the absence of the name and the amount, not about wording.
 */
import {
  computeDigestPlan,
  computeReminderPlans,
  diffScheduledNotifications,
  renewalCopy,
  trialCopy,
} from '@/features/notifications/engine';
import { NOW, sub } from './fixtures';
import type { ScheduledNotification } from '@/types';

const MORNING = '2026-10-10T06:00:00';
const OPTIONS = { nowISO: MORNING, horizonDays: 10 } as const;

describe('generic lock-screen text', () => {
  it('still names the subscription and amount by default', () => {
    const [plan] = computeReminderPlans([sub({})], OPTIONS);
    expect(plan.title).toContain('Netflix');
    expect(plan.title).toContain('$15.49');
  });

  it('omits both the name and the amount when enabled', () => {
    const plans = computeReminderPlans([sub({})], { ...OPTIONS, genericText: true });
    expect(plans.length).toBeGreaterThan(0);
    for (const plan of plans) {
      expect(plan.title).not.toContain('Netflix');
      expect(plan.body).not.toContain('Netflix');
      expect(`${plan.title} ${plan.body}`).not.toContain('15.49');
      expect(`${plan.title} ${plan.body}`).not.toContain('$');
    }
  });

  it('covers trial reminders too', () => {
    const trialing = sub({ status: 'trialing', trialEndDate: '2026-10-12' });
    const plans = computeReminderPlans([trialing], { ...OPTIONS, genericText: true });
    const trials = plans.filter((p) => p.type === 'trial');
    expect(trials.length).toBeGreaterThan(0);
    for (const plan of trials) {
      expect(`${plan.title} ${plan.body}`).not.toContain('Netflix');
    }
  });

  it('keeps the trigger times identical, so privacy does not change WHEN you are reminded', () => {
    const detailed = computeReminderPlans([sub({})], OPTIONS);
    const generic = computeReminderPlans([sub({})], { ...OPTIONS, genericText: true });
    expect(generic.map((p) => p.triggerAt)).toEqual(detailed.map((p) => p.triggerAt));
  });

  it('leaves the weekly digest alone — it was already generic', () => {
    const digest = computeDigestPlan([sub({})], OPTIONS);
    expect(digest?.title).not.toContain('Netflix');
  });
});

describe('toggling the setting reschedules instead of leaking the old copy', () => {
  it('gives generic plans different dedup keys, so the detailed ones get cancelled', () => {
    const detailed = computeReminderPlans([sub({})], OPTIONS);
    const generic = computeReminderPlans([sub({})], { ...OPTIONS, genericText: true });

    const existing: ScheduledNotification[] = detailed.map((p, i) => ({
      key: p.key,
      subscriptionId: p.subscriptionId,
      type: p.type,
      occurrenceDate: p.occurrenceDate,
      leadDays: p.leadDays,
      triggerAt: p.triggerAt,
      osNotificationId: `os-${i}`,
      status: 'scheduled' as const,
      createdAt: NOW,
    }));

    const diff = diffScheduledNotifications(generic, existing);
    // Every detailed reminder is replaced: none of it survives on the OS.
    expect(diff.toCancel).toHaveLength(existing.length);
    expect(diff.toSchedule).toHaveLength(generic.length);
  });

  it('does not churn when the setting is unchanged', () => {
    const plans = computeReminderPlans([sub({})], OPTIONS);
    const existing: ScheduledNotification[] = plans.map((p, i) => ({
      key: p.key,
      subscriptionId: p.subscriptionId,
      type: p.type,
      occurrenceDate: p.occurrenceDate,
      leadDays: p.leadDays,
      triggerAt: p.triggerAt,
      osNotificationId: `os-${i}`,
      status: 'scheduled' as const,
      createdAt: NOW,
    }));

    const diff = diffScheduledNotifications(plans, existing);
    expect(diff.toCancel).toHaveLength(0);
    expect(diff.toSchedule).toHaveLength(0);
  });
});

describe('copy helpers', () => {
  it('keeps the historical key format for detailed reminders', () => {
    const [detailed] = computeReminderPlans([sub({})], OPTIONS);
    expect(detailed.key).toBe(`s1:${detailed.occurrenceDate}:renewal:${detailed.leadDays}`);
  });

  it.each([0, 1, 3])('produces private renewal copy for a %i-day lead', (leadDays) => {
    const copy = renewalCopy('Netflix', 1549, 'USD', '2026-10-13', leadDays, '2026-10-10', 'generic');
    expect(copy.title).not.toContain('Netflix');
    expect(`${copy.title} ${copy.body}`).not.toContain('15.49');
  });

  it.each([0, 1])('produces private trial copy for a %i-day lead', (leadDays) => {
    const copy = trialCopy('Netflix', '2026-10-12', leadDays, '2026-10-10', 'generic');
    expect(copy.title).not.toContain('Netflix');
  });
});
