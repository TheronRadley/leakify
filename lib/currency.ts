/**
 * Currency awareness. Amounts are integer minor units; formatting uses the
 * platform Intl implementation. Leakify never converts between currencies —
 * totals are grouped and displayed per currency instead.
 */

/** Fraction digits for a currency per ISO 4217 (2 for USD/EUR, 0 for JPY, 3 for KWD...). */
export function currencyFractionDigits(currency: string): number {
  try {
    const opts = new Intl.NumberFormat('en-US', { currency, style: 'currency' }).resolvedOptions();
    if (typeof opts.maximumFractionDigits === 'number') return opts.maximumFractionDigits;
  } catch {
    // unknown currency code — fall through to default
  }
  return 2;
}

/** Format minor units as a localized currency string, e.g. 1549 USD -> "$15.49". */
export function formatMoney(
  amountCents: number,
  currency: string,
  options: { locale?: string; signDisplay?: 'auto' | 'always' | 'never' } = {},
): string {
  const digits = currencyFractionDigits(currency);
  try {
    return new Intl.NumberFormat(options.locale, {
      style: 'currency',
      currency,
      signDisplay: options.signDisplay,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amountCents / 10 ** digits);
  } catch {
    return `${currency} ${(amountCents / 10 ** digits).toFixed(digits)}`;
  }
}

/** Compact display for large dashboard figures, e.g. "$1.2K". Falls back to formatMoney. */
export function formatMoneyCompact(amountCents: number, currency: string, locale?: string): string {
  const digits = currencyFractionDigits(currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amountCents / 10 ** digits);
  } catch {
    return formatMoney(amountCents, currency, { locale });
  }
}

/**
 * Parse a user-typed decimal string ("15.49", "15,49", "15") into minor units
 * for the given currency. Returns null when the input is not a valid amount or
 * has more precision than the currency supports.
 */
export function decimalToMinorUnits(input: string, currency: string): number | null {
  const trimmed = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,9}(\.\d{0,9})?$/.test(trimmed)) return null;
  const digits = currencyFractionDigits(currency);
  const [whole, frac = ''] = trimmed.split('.');
  if (frac.length > digits) return null;
  const minor = parseInt(whole, 10) * 10 ** digits + parseInt(frac.padEnd(digits, '0') || '0', 10);
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Inverse of decimalToMinorUnits for pre-filling form fields: 1549 -> "15.49". */
export function minorUnitsToDecimal(amountCents: number, currency: string): string {
  const digits = currencyFractionDigits(currency);
  const whole = Math.floor(Math.abs(amountCents) / 10 ** digits);
  const frac = String(Math.abs(amountCents) % 10 ** digits).padStart(digits, '0');
  return digits > 0 ? `${whole}.${frac}` : String(whole);
}

export interface CurrencyTotal {
  currency: string;
  amountCents: number;
}

/** Render a per-currency total list as "A + B" or a single formatted amount. */
export function joinCurrencyTotals(
  totals: CurrencyTotal[],
  locale?: string,
  format: (c: number, cur: string, l?: string) => string = (c, cur, l) =>
    formatMoney(c, cur, { locale: l }),
): string {
  if (totals.length === 0) return '';
  return totals.map((t) => format(t.amountCents, t.currency, locale)).join(' + ');
}
