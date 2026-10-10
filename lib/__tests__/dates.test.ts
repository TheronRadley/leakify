import {
  addInterval,
  daysBetween,
  isValidISODate,
  nextOccurrenceOnOrAfter,
  nthOccurrence,
  relativeDayLabel,
  subtractDaysISO,
  todayISO,
} from '@/lib/dates';

describe('addInterval', () => {
  const monthly = { every: 1, unit: 'month' as const };

  it('clamps Jan 31 + 1 month to Feb 28 in non-leap years', () => {
    const result = addInterval(new Date(2025, 0, 31), monthly);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(28);
  });

  it('clamps Jan 31 + 1 month to Feb 29 in leap years', () => {
    const result = addInterval(new Date(2024, 0, 31), monthly);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(29);
  });

  it('handles Feb 29 yearly anchors by clamping to Feb 28', () => {
    const result = addInterval(new Date(2024, 1, 29), { every: 1, unit: 'year' });
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(28);
  });

  it('adds quarters from month-end anchors without overflow into next month', () => {
    const result = addInterval(new Date(2025, 4, 31), { every: 3, unit: 'month' }); // May 31 -> Aug 31
    expect(result.getMonth()).toBe(7);
    expect(result.getDate()).toBe(31);
  });
});

describe('nthOccurrence keeps the anchor day across short months', () => {
  it('Jan 31 monthly => Feb 28 then Mar 31 (no drift)', () => {
    expect(nthOccurrence('2025-01-31', { every: 1, unit: 'month' }, 1)).toBe('2025-02-28');
    expect(nthOccurrence('2025-01-31', { every: 1, unit: 'month' }, 2)).toBe('2025-03-31');
    expect(nthOccurrence('2025-01-31', { every: 1, unit: 'month' }, 3)).toBe('2025-04-30');
  });

  it('Jan 29, 30, 31 all stay on their anchor day when the month allows', () => {
    const monthly = { every: 1, unit: 'month' as const };
    expect(nthOccurrence('2025-01-29', monthly, 2)).toBe('2025-03-29');
    expect(nthOccurrence('2025-01-30', monthly, 2)).toBe('2025-03-30');
    expect(nthOccurrence('2025-01-31', monthly, 2)).toBe('2025-03-31');
  });
});

describe('nextOccurrenceOnOrAfter', () => {
  it('returns the anchor when the reference is before it', () => {
    expect(nextOccurrenceOnOrAfter('2026-12-25', { every: 1, unit: 'month' }, '2026-10-10')).toBe('2026-12-25');
  });

  it('rolls monthly schedules forward to the first occurrence in the future', () => {
    expect(nextOccurrenceOnOrAfter('2026-01-15', { every: 1, unit: 'month' }, '2026-10-10')).toBe('2026-10-15');
  });

  it('rolls weekly schedules forward correctly', () => {
    // anchor Mon 2026-09-07; ref 2026-10-10 (Sat) => next Mon is 2026-10-12
    expect(nextOccurrenceOnOrAfter('2026-09-07', { every: 1, unit: 'week' }, '2026-10-10')).toBe('2026-10-12');
  });

  it('handles Feb 29 anchors across leap boundaries', () => {
    expect(nextOccurrenceOnOrAfter('2024-02-29', { every: 1, unit: 'year' }, '2026-01-01')).toBe('2026-02-28');
    expect(nextOccurrenceOnOrAfter('2024-02-29', { every: 1, unit: 'year' }, '2027-06-01')).toBe('2028-02-29');
  });

  it('handles custom intervals (every 6 weeks)', () => {
    const custom = { every: 6, unit: 'week' as const };
    // Occurrences from Jan 1 2026 every 42 days: Sep 10, Oct 22 — so the first
    // occurrence on/after Oct 1 is Oct 22.
    expect(nextOccurrenceOnOrAfter('2026-01-01', custom, '2026-10-01')).toBe('2026-10-22');
  });

  it('returns null for invalid anchors', () => {
    expect(nextOccurrenceOnOrAfter('not-a-date', { every: 1, unit: 'month' }, '2026-10-10')).toBeNull();
  });
});

describe('relativeDayLabel', () => {
  const ref = '2026-10-10';
  it('labels today, tomorrow and near future dates', () => {
    expect(relativeDayLabel('2026-10-10', ref)).toBe('Today');
    expect(relativeDayLabel('2026-10-11', ref)).toBe('Tomorrow');
    expect(relativeDayLabel('2026-10-13', ref)).toBe('In 3 days');
  });
  it('falls back to absolute dates further out', () => {
    expect(relativeDayLabel('2026-11-05', ref)).toBe('Nov 5');
    expect(relativeDayLabel('2027-01-05', ref)).toBe('Jan 5, 2027');
  });
  it('returns null for past dates', () => {
    expect(relativeDayLabel('2026-10-09', ref)).toBeNull();
  });
});

describe('daysBetween / subtractDaysISO / validity', () => {
  it('counts calendar days', () => {
    expect(daysBetween('2026-10-10', '2026-10-13')).toBe(3);
    expect(daysBetween('2026-10-13', '2026-10-10')).toBe(-3);
  });
  it('subtracts days for reminder leads', () => {
    expect(subtractDaysISO('2026-10-10', 3)).toBe('2026-10-07');
    expect(subtractDaysISO('2026-03-01', 1)).toBe('2026-02-28');
  });
  it('validates ISO dates strictly', () => {
    expect(isValidISODate('2026-10-10')).toBe(true);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('1999-01-01')).toBe(false);
    expect(isValidISODate('')).toBe(false);
    expect(isValidISODate(null)).toBe(false);
  });
  it('todayISO returns a yyyy-MM-dd string', () => {
    expect(todayISO(new Date(2026, 9, 10))).toBe('2026-10-10');
  });
});
