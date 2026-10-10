/**
 * Billing-calendar logic (pure). Handles month navigation, highlighting, and
 * day-level charge lists. Recurrence uses anchor-stepping so the 29th/30th/
 * 31st and Feb-29 schedules land on sensible dates (see lib/dates).
 */
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import {
  daysBetween,
  isValidISODate,
  nextOccurrenceOnOrAfter,
  parseISODate,
  toISODate,
  todayISO,
} from '@/lib/dates';
import type { CurrencyCode, Subscription } from '@/types';

export interface CalendarDayCell {
  /** Local ISO date the cell represents. */
  dateISO: string;
  /** Whether it belongs to the displayed month (edges show adjacent months). */
  inCurrentMonth: boolean;
  isToday: boolean;
}

/** Build a 6-row x 7-col grid for a given month. weekStartsOn: 0 = Sunday, 1 = Monday. */
export function buildMonthGrid(
  year: number,
  monthIndex: number,
  weekStartsOn: 0 | 1 = 1,
  refNow: Date = new Date(),
): CalendarDayCell[] {
  const first = startOfMonth(new Date(year, monthIndex, 1));
  const firstDow = (first.getDay() - weekStartsOn + 7) % 7;
  const today = toISODate(refNow);
  const cells: CalendarDayCell[] = [];
  const start = new Date(first);
  start.setDate(first.getDate() - firstDow);
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = toISODate(d);
    cells.push({ dateISO: iso, inCurrentMonth: d.getMonth() === monthIndex, isToday: iso === today });
  }
  return cells;
}

export interface MonthCursor {
  year: number;
  monthIndex: number; // 0-based
}

export function cursorFor(date: Date): MonthCursor {
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

export function shiftMonth(cursor: MonthCursor, delta: number): MonthCursor {
  const shifted = addMonths(new Date(cursor.year, cursor.monthIndex, 1), delta);
  return { year: shifted.getFullYear(), monthIndex: shifted.getMonth() };
}

export function monthTitle(cursor: MonthCursor): string {
  return format(new Date(cursor.year, cursor.monthIndex, 1), 'MMMM yyyy');
}

export interface DayCharge {
  subscriptionId: string;
  name: string;
  amountCents: number;
  currency: CurrencyCode;
  type: 'renewal' | 'trial_end';
  status: Subscription['status'];
}

function isLive(sub: Subscription): boolean {
  return !sub.archivedAt && (sub.status === 'active' || sub.status === 'trialing');
}

/**
 * Charges occurring on an exact date: renewals whose recurrence lands on the
 * date, plus trial expirations (distinctly typed so the UI can tell them apart).
 */
export function chargesOnDate(subs: Subscription[], dateISO: string): DayCharge[] {
  if (!isValidISODate(dateISO)) return [];
  const charges: DayCharge[] = [];
  for (const sub of subs) {
    if (!isLive(sub)) continue;
    if (sub.nextBillingDate) {
      const anchorGone = daysBetween(sub.nextBillingDate, dateISO);
      if (anchorGone !== null && anchorGone >= 0) {
        const occurrence = nextOccurrenceOnOrAfter(sub.nextBillingDate, sub.interval, dateISO);
        if (occurrence === dateISO) {
          charges.push({
            subscriptionId: sub.id,
            name: sub.name,
            amountCents: sub.amountCents,
            currency: sub.currency,
            type: 'renewal',
            status: sub.status,
          });
        }
      }
    }
    if (sub.trialEndDate === dateISO) {
      charges.push({
        subscriptionId: sub.id,
        name: sub.name,
        amountCents: sub.amountCents,
        currency: sub.currency,
        type: 'trial_end',
        status: sub.status,
      });
    }
  }
  return charges;
}

/** Map of every dateISO in a month to its charges (maps to highlight markers). */
export function chargesForMonth(
  subs: Subscription[],
  cursor: MonthCursor,
): Map<string, DayCharge[]> {
  const result = new Map<string, DayCharge[]>();
  const first = startOfMonth(new Date(cursor.year, cursor.monthIndex, 1));
  const last = endOfMonth(first);
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    const iso = toISODate(d);
    const charges = chargesOnDate(subs, iso);
    if (charges.length > 0) result.set(iso, charges);
  }
  return result;
}

/** Sum of a day's charges per currency (never mixed). */
export function totalsForDay(charges: DayCharge[]): { currency: CurrencyCode; amountCents: number }[] {
  const map = new Map<CurrencyCode, number>();
  for (const charge of charges) {
    if (charge.type !== 'renewal') continue; // trial-end is a deadline, not a charge
    map.set(charge.currency, (map.get(charge.currency) ?? 0) + charge.amountCents);
  }
  return [...map.entries()]
    .map(([currency, amountCents]) => ({ currency, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

/** Whether a parsed cursor is valid/sane. */
export function isValidCursor(cursor: MonthCursor): boolean {
  return (
    Number.isInteger(cursor.year) &&
    Number.isInteger(cursor.monthIndex) &&
    cursor.monthIndex >= 0 &&
    cursor.monthIndex <= 11 &&
    Boolean(parseISODate(`${cursor.year}-01-01`))
  );
}

export { todayISO };
