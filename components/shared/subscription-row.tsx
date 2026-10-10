import { CategoryIcon } from '@/components/shared/category-icon';
import { MoneyText } from '@/components/shared/money';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { intervalLabel } from '@/lib/billing';
import { relativeDayLabel, todayISO } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { Link } from 'expo-router';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import type { Subscription } from '@/types';

const STATUS_LABEL: Record<Subscription['status'], string> = {
  active: 'Active',
  trialing: 'Trial',
  paused: 'Paused',
  canceled: 'Canceled',
};

const STATUS_VARIANT: Record<Subscription['status'], 'secondary' | 'success' | 'warning' | 'outline'> = {
  active: 'success',
  trialing: 'warning',
  paused: 'secondary',
  canceled: 'outline',
};

export interface SubscriptionRowProps {
  subscription: Subscription;
  /** Emphasize the next billing date (Home upcoming list). */
  showNextCharge?: boolean;
  /** Caller-controlled "today" ISO override for predictable labels. */
  refISO?: string;
  testID?: string;
}

/** One row in any subscription list. Tapping opens the detail screen. */
export function SubscriptionRow({
  subscription: sub,
  showNextCharge = false,
  refISO,
  testID,
}: SubscriptionRowProps) {
  const today = refISO ?? todayISO();
  const nextLabel = sub.nextBillingDate ? relativeDayLabel(sub.nextBillingDate, today) : 'No date';
  return (
    <Link href={`/subscription/${sub.id}`} asChild>
      <Pressable
        testID={testID ?? `subscription-row-${sub.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${sub.name}, ${STATUS_LABEL[sub.status]}, next charge ${nextLabel ?? 'unknown'}`}
        className={cn(
          'flex-row items-center gap-3 rounded-lg border border-border bg-card p-3.5 active:bg-accent/40',
          sub.archivedAt ? 'opacity-60' : undefined,
        )}
      >
        <CategoryIcon category={sub.category} size={40} />
        <View className="flex-1 gap-0.5">
          <Text className="font-semibold" numberOfLines={1}>
            {sub.name}
          </Text>
          <Text variant="small" className="text-muted-foreground" numberOfLines={1}>
            {showNextCharge
              ? nextLabel
                ? `${nextLabel} · ${intervalLabel(sub.interval)}`
                : `${intervalLabel(sub.interval)}`
              : `${intervalLabel(sub.interval)}`}
            {sub.paymentMethodLabel ? ` · ${sub.paymentMethodLabel}` : ''}
          </Text>
        </View>
        <View className="items-end gap-1.5">
          <MoneyText amountCents={sub.amountCents} currency={sub.currency} variant="small" />
          <Badge variant={STATUS_VARIANT[sub.status]} label={STATUS_LABEL[sub.status]} />
        </View>
      </Pressable>
    </Link>
  );
}
