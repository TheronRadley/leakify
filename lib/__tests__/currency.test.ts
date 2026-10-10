import {
  currencyFractionDigits,
  decimalToMinorUnits,
  formatMoney,
  joinCurrencyTotals,
  minorUnitsToDecimal,
} from '@/lib/currency';

describe('currencyFractionDigits', () => {
  it('knows common exponents', () => {
    expect(currencyFractionDigits('USD')).toBe(2);
    expect(currencyFractionDigits('EUR')).toBe(2);
    expect(currencyFractionDigits('JPY')).toBe(0);
    expect(currencyFractionDigits('KWD')).toBe(3);
  });
  it('falls back to 2 for unknown codes', () => {
    expect(currencyFractionDigits('XXX')).toBe(2);
  });
});

describe('formatMoney', () => {
  it('formats two-decimal currencies', () => {
    expect(formatMoney(1549, 'USD', { locale: 'en-US' })).toBe('$15.49');
    expect(formatMoney(0, 'USD', { locale: 'en-US' })).toBe('$0.00');
  });
  it('formats zero-decimal currencies without decimals', () => {
    expect(formatMoney(1500, 'JPY', { locale: 'en-US' })).toContain('1,500');
  });
  it('formats EUR per locale conventions', () => {
    expect(formatMoney(1050, 'EUR', { locale: 'de-DE' })).toContain('10,5');
  });
});

describe('decimalToMinorUnits', () => {
  it('parses plain decimals', () => {
    expect(decimalToMinorUnits('15.49', 'USD')).toBe(1549);
    expect(decimalToMinorUnits('15,99', 'EUR')).toBe(1599);
    expect(decimalToMinorUnits('15', 'USD')).toBe(1500);
  });
  it('rejects too many decimals for the currency', () => {
    expect(decimalToMinorUnits('15.499', 'USD')).toBeNull();
  });
  it('handles zero-decimal currencies', () => {
    expect(decimalToMinorUnits('1500', 'JPY')).toBe(1500);
    expect(decimalToMinorUnits('1500.5', 'JPY')).toBeNull();
  });
  it('rejects junk and negatives', () => {
    expect(decimalToMinorUnits('abc', 'USD')).toBeNull();
    expect(decimalToMinorUnits('-5', 'USD')).toBeNull();
    expect(decimalToMinorUnits('', 'USD')).toBeNull();
  });
});

describe('minorUnitsToDecimal round-trip', () => {
  it('converts back to a decimal string', () => {
    expect(minorUnitsToDecimal(1549, 'USD')).toBe('15.49');
    expect(minorUnitsToDecimal(1500, 'JPY')).toBe('1500');
  });
});

describe('joinCurrencyTotals keeps currencies distinct', () => {
  it('joins with a plus, never a pretended conversion', () => {
    const out = joinCurrencyTotals([
      { currency: 'USD', amountCents: 1000 },
      { currency: 'EUR', amountCents: 2000 },
    ], 'en-US');
    expect(out).toBe('$10.00 + €20.00');
  });
});
