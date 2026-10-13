import { CategoryIcon } from '@/components/shared/category-icon';
import { MoneyText } from '@/components/shared/money';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { LivePulseDot, ScaleOnPress } from '@/components/ui/motion';
import { Text } from '@/components/ui/text';
import { intervalLabel, latestPriceChange } from '@/lib/billing';
import { categoryLabel } from '@/lib/constants';
import { formatMoney } from '@/lib/currency';
import { daysBetween, relativeDayLabel, todayISO } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { Subscription } from '@/types';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

export interface SubscriptionRowProps {
  subscription: Subscription;
  onPress?: () => void;
  showCategory?: boolean;
  rightSubtext?: string;
  className?: string;
}

const STATUS_BADGE: Record<
  Subscription['status'],
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'warning' | 'destructive' }
> = {
  active: { label: 'Active', variant: 'secondary' },
  trialing: { label: 'Trial', variant: 'warning' },
  paused: { label: 'Paused', variant: 'outline' },
  canceled: { label: 'Canceled', variant: 'outline' },
};

export function SubscriptionRow({
  subscription,
  onPress,
  showCategory = true,
  rightSubtext,
  className,
}: SubscriptionRowProps) {
  const router = useRouter();
  const today = todayISO();
  const days = subscription.nextBillingDate
    ? daysBetween(today, subscription.nextBillingDate)
    : null;
  const rel = subscription.nextBillingDate
    ? relativeDayLabel(subscription.nextBillingDate, today)
    : null;
  const priceChange = latestPriceChange(subscription);

  const urgent =
    (subscription.status === 'active' || subscription.status === 'trialing') &&
    days !== null &&
    days >= 0 &&
    days <= 3;

  const handlePress = React.useCallback(() => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/subscription/${subscription.id}`);
    }
  }, [onPress, router, subscription.id]);

  const statusMeta = STATUS_BADGE[subscription.status];

  return (
    <ScaleOnPress
      scaleTo={0.99}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${subscription.name}, ${formatMoney(subscription.amountCents, subscription.currency)} ${intervalLabel(subscription.interval)}`}
    >
      <Item
        variant="outline"
        size="sm"
        className={cn(
          'bg-card shadow-2xs web:transition-all web:duration-200 web:hover:border-foreground/20 web:hover:bg-accent/40 active:bg-accent/60',
          urgent && 'border-warning/40',
          subscription.status === 'canceled' && 'opacity-65',
          className,
        )}
      >
        <ItemMedia>
          <CategoryIcon category={subscription.category} size={38} />
        </ItemMedia>

        <ItemContent>
          <View className="flex-row flex-wrap items-center gap-1.5">
            <ItemTitle numberOfLines={1} className="shrink font-semibold">
              {subscription.name}
            </ItemTitle>
            {subscription.status !== 'active' ? (
              <Badge variant={statusMeta.variant}>
                <Text>{statusMeta.label}</Text>
              </Badge>
            ) : null}
            {subscription.flaggedUnused ? (
              <Badge variant="outline">
                <Text>Unused?</Text>
              </Badge>
            ) : null}
            {priceChange && priceChange.toCents > priceChange.fromCents ? (
              <Badge variant="warning">
                <Text>Price up</Text>
              </Badge>
            ) : null}
          </View>

          <View className="flex-row items-center gap-1.5">
            {urgent ? <LivePulseDot tone="warning" size={6} /> : null}
            <ItemDescription
              numberOfLines={1}
              className={cn(urgent && 'font-medium text-warning')}
            >
              {showCategory ? categoryLabel(subscription.category) : ''}
              {rel ? `${showCategory ? ' · ' : ''}Due ${rel.toLowerCase()}` : ''}
              {subscription.paymentMethodLabel
                ? ` · ${subscription.paymentMethodLabel}`
                : ''}
            </ItemDescription>
          </View>
        </ItemContent>

        <ItemActions className="gap-2.5">
          <View className="items-end gap-0.5">
            <MoneyText
              amountCents={subscription.amountCents}
              currency={subscription.currency}
              className="text-sm font-semibold text-foreground"
            />
            <Text className="text-[11px] text-muted-foreground">
              {rightSubtext ?? intervalLabel(subscription.interval)}
            </Text>
          </View>
          <Icon as={ChevronRight} size={15} className="text-muted-foreground/60" />
        </ItemActions>
      </Item>
    </ScaleOnPress>
  );
}
