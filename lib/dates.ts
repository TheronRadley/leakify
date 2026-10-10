/**
 * Calendar-aware date utilities for billing schedules.
 *
 * All billing dates are local-calendar ISO dates ("yyyy-MM-dd"). Recurrence
 * math always steps from the original anchor date multiplied by n periods, so
 * month-end anchors (29th/30th/31st) do not drift: addMonths clamps to the
 * last valid day of a shorter month, and multiplying n keeps the intended day
 * wherever the target month allows it.
 */
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  isSameDay,
  isValid,
  parseISO,
} from 'date-fns';
import type { BillingIntervalValue } from '@/types';

export const ISO_DATE_FORMAT = 'yyyy-MM-dd';

/** Format a Date as a local ISO calendar date. */
export function toISODate(date: Date): string {
  return format(date, ISO_DATE_FORMAT);
}

/** Today's local ISO calendar date. */
export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

/** Parse an ISO calendar date ("yyyy-MM-dd") to a local Date. Returns null when invalid. */
export function parseISODate(value: string | null | undefined): Date | null {
  if (!value) return null;
  // parseISO with date-only input already yields a LOCAL midnight date.
  const parsed = parseISO(value);
  if (!isValid(parsed)) return null;
  // Guard against obviously wrong persisted values.
  if (parsed.getFullYear() < 2000 || parsed.getFullYear() > 2200) return null;
  return parsed;
}

export function isValidISODate(value: string | null | undefined): boolean {
  return parseISODate(value) !== null;
}

/** Add a single billing interval to a date. */
export function addInterval(date: Date, interval: BillingIntervalValue, multiplier = 1): Date {
  const every = Math.max(1, Math.floor(interval.every)) * multiplier;
  switch (interval.unit) {
    case 'day':
      return addDays(date, every);
    case 'week':
      return addWeeks(date, every);
    case 'month':
      // date-fns clamps month-end overflow to the last day of the shorter month.
      return addMonths(date, every);
    case 'year':
      return addYears(date, every); // handles Feb 29 anchors by clamping to Feb 28
  }
}

/**
 * The n-th occurrence of a schedule anchored at `anchor` (n >= 1 gives future
 * occurrences). Stepping from the anchor keeps month-end semantics stable:
 * anchor Jan 31 monthly => occurrences Jan 31, Feb 28/29, Mar 31, Apr 30...
 */
export function nthOccurrence(anchorISO: string, interval: BillingIntervalValue, n: number): string | null {
  const anchor = parseISODate(anchorISO);
  if (!anchor) return null;
  return toISODate(addInterval(anchor, interval, n));
}

/**
 * Index n of the first occurrence (anchor + n·interval) that falls on or
 * after `refISO`. Used together with nthOccurrence so enumerating a schedule
 * always steps from the anchor — preventing month-end drift.
 */
export function firstOccurrenceIndex(
  anchorISO: string,
  interval: BillingIntervalValue,
  refISO: string,
): number | null {
  const anchor = parseISODate(anchorISO);
  const ref = parseISODate(refISO);
  if (!anchor || !ref) return null;
  if (differenceInCalendarDays(ref, anchor) <= 0) return 0;

  const unitDays = { day: 1, week: 7, month: 30, year: 365 }[interval.unit];
  const periodDays = Math.max(1, Math.floor(interval.every)) * unitDays;
  let n = Math.max(1, Math.floor(differenceInCalendarDays(ref, anchor) / periodDays));
  while (differenceInCalendarDays(addInterval(anchor, interval, n), ref) < 0) n += 1;
  while (n >= 1 && differenceInCalendarDays(addInterval(anchor, interval, n - 1), ref) >= 0) n -= 1;
  return n;
}

/**
 * Next occurrence of a schedule anchored at `anchorISO` that falls on or after
 * `refISO`. Returns null for invalid input.
 */
export function nextOccurrenceOnOrAfter(
  anchorISO: string,
  interval: BillingIntervalValue,
  refISO: string,
): string | null {
  const anchor = parseISODate(anchorISO);
  const ref = parseISODate(refISO);
  if (!anchor || !ref) return null;
  if (differenceInCalendarDays(ref, anchor) <= 0) return anchorISO;

  // Estimate n from the day difference, then walk forward/backward as needed.
  const unitDays = { day: 1, week: 7, month: 30, year: 365 }[interval.unit];
  const periodDays = Math.max(1, Math.floor(interval.every)) * unitDays;
  let n = Math.max(1, Math.floor(differenceInCalendarDays(ref, anchor) / periodDays));
  let candidate = addInterval(anchor, interval, n);
  while (differenceInCalendarDays(candidate, ref) < 0) {
    n += 1;
    candidate = addInterval(anchor, interval, n);
  }
  while (n >= 1 && differenceInCalendarDays(addInterval(anchor, interval, n - 1), ref) >= 0) {
    n -= 1;
  }
  return toISODate(addInterval(anchor, interval, n));
}

/** Whole calendar days from `fromISO` to `toISO` (positive when toISO is later). */
export function daysBetween(fromISO: string, toISO: string): number | null {
  const from = parseISODate(fromISO);
  const to = parseISODate(toISO);
  if (!from || !to) return null;
  return differenceInCalendarDays(to, from);
}

/**
 * Human relative-day label: "Today", "Tomorrow", "In 3 days",
 * or an absolute "Oct 21" / "Oct 21, 2027" when far in the future.
 */
export function relativeDayLabel(isoDate: string, refISO: string = todayISO()): string | null {
  const target = parseISODate(isoDate);
  const ref = parseISODate(refISO);
  if (!target || !ref) return null;
  const diff = differenceInCalendarDays(target, ref);
  if (diff < 0) return null;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff <= 13) return `In ${diff} days`;
  return target.getFullYear() === ref.getFullYear()
    ? format(target, 'MMM d')
    : format(target, 'MMM d, yyyy');
}

export function isSameISODate(a: string, b: string): boolean {
  const da = parseISODate(a);
  const db = parseISODate(b);
  if (!da || !db) return false;
  return isSameDay(da, db);
}

/** Subtract N calendar days from an ISO date (used for reminder lead times). */
export function subtractDaysISO(isoDate: string, days: number): string | null {
  const parsed = parseISODate(isoDate);
  if (!parsed) return null;
  return toISODate(addDays(parsed, -days));
}

/** Format an ISO date for display, e.g. "Oct 21, 2026". */
export function formatDisplayDate(isoDate: string | null | undefined): string {
  const date = parseISODate(isoDate ?? null);
  if (!date) return '—';
  return format(date, 'MMM d, yyyy');
}
