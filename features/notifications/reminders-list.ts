/**
 * Builds the visible "upcoming reminders" inbox from the same engine data the
 * OS schedule uses — so what the user sees is exactly what will fire.
 */
import { computeReminderPlans, isReminderEligible, REMINDER_FIRE_HOUR } from '@/features/notifications/engine';
import { relativeDayLabel, subtractDaysISO } from '@/lib/dates';
import type { CurrencyCode, Subscription } from '@/types';

export interface ReminderListItem {
  subscriptionId: string;
  type: 'renewal' | 'trial';
  occurrenceDate: string;
  leadDays: number;
  title: string;
  fireLabel: string;
  amountCents: number | null;
  currency: CurrencyCode | null;
}

export function computesReminderList(subs: Subscription[], refISO: string): ReminderListItem[] {
  const plans = computeReminderPlans(subs, { nowISO: `${refISO}T00:00:00` });
  return plans.map((plan) => {
    const sub = subs.find((s) => s.id === plan.subscriptionId);
    const fireDateISO = subtractDaysISO(plan.occurrenceDate, plan.leadDays);
    const fireLabel =
      (fireDateISO ? relativeDayLabel(fireDateISO, refISO) : null) ?? fireDateISO ?? plan.occurrenceDate;
    return {
      subscriptionId: plan.subscriptionId,
      type: plan.type,
      occurrenceDate: plan.occurrenceDate,
      leadDays: plan.leadDays,
      title: plan.title,
      fireLabel: `${fireLabel} at ${REMINDER_FIRE_HOUR}:00`,
      amountCents: plan.type === 'renewal' ? (sub?.amountCents ?? null) : null,
      currency: sub?.currency ?? null,
    };
  });
}

export { isReminderEligible };
