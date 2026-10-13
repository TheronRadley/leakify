import { Text, type textVariants } from '@/components/ui/text';
import { formatMoney, joinCurrencyTotals } from '@/lib/currency';
import { cn } from '@/lib/utils';
import type { CurrencyCode } from '@/types';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

/**
 * Hook that smoothly interpolates a numeric value with a cubic-out easing curve
 * so financial totals feel alive when loading or updating.
 */
function useAnimatedCents(targetCents: number, duration = 450): number {
  const [displayCents, setDisplayCents] = React.useState(targetCents);
  const prevRef = React.useRef(targetCents);

  React.useEffect(() => {
    const from = prevRef.current;
    const to = targetCents;
    prevRef.current = to;

    if (from === to || typeof requestAnimationFrame === 'undefined') {
      setDisplayCents(to);
      return undefined;
    }

    let frameId: number;
    const start = Date.now();

    const step = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayCents(Math.round(from + (to - from) * eased));
      if (t < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [targetCents, duration]);

  return displayCents;
}

/** Formats minor units into a styled currency string with smooth count-up transition. */
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
  const animatedCents = useAnimatedCents(amountCents);
  return (
    <Text
      variant={variant}
      accessibilityLabel={formatMoney(amountCents, currency)}
      className={cn('font-semibold tabular-nums', className)}
      {...props}
    >
      {formatMoney(animatedCents, currency)}
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
  const primaryCents = totals[0]?.amountCents ?? 0;
  const animatedFirstCents = useAnimatedCents(primaryCents);

  const animatedTotals = React.useMemo(() => {
    if (totals.length === 0) return [];
    return totals.map((item, idx) =>
      idx === 0 ? { ...item, amountCents: animatedFirstCents } : item,
    );
  }, [totals, animatedFirstCents]);

  return (
    <Text
      variant={variant}
      accessibilityLabel={totals.length === 0 ? placeholder : joinCurrencyTotals(totals)}
      className={cn('font-semibold tabular-nums', className)}
      {...props}
    >
      {animatedTotals.length === 0 ? placeholder : joinCurrencyTotals(animatedTotals)}
    </Text>
  );
}
