import { Text, type textVariants } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { formatMoney, joinCurrencyTotals } from '@/lib/currency';
import type { CurrencyCode } from '@/types';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

/** Formats minor units into a styled currency string. */
export function MoneyText({
  amountCents,
  currency,
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof Text> &
  VariantProps<typeof textVariants> & {
    amountCents: number;
    currency: CurrencyCode;
    variant?: VariantProps<typeof textVariants>['variant'];
  }) {
  return (
    <Text variant={variant} className={cn('font-semibold tabular-nums', className)} {...props}>
      {formatMoney(amountCents, currency)}
    </Text>
  );
}

/**
 * Renders a per-currency totals list ("$120.00 + €9.90") without ever
 * converting between currencies.
 */
export function CurrencyTotalsText({
  totals,
  className,
  variant = 'default',
  placeholder = '—',
  ...props
}: React.ComponentProps<typeof Text> &
  VariantProps<typeof textVariants> & {
    totals: { currency: CurrencyCode; amountCents: number }[];
    variant?: VariantProps<typeof textVariants>['variant'];
    placeholder?: string;
  }) {
  return (
    <Text variant={variant} className={cn('font-semibold tabular-nums', className)} {...props}>
      {totals.length === 0 ? placeholder : joinCurrencyTotals(totals)}
    </Text>
  );
}
