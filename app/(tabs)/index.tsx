import { MoneyText, CurrencyTotalsText } from '@/components/shared/money';
import { Screen } from '@/components/shared/screen';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared/state-views';
import { CategoryIcon } from '@/components/shared/category-icon';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import {
  annualProjectionByCurrency,
  contributesToRecurringSpend,
  monthlyRecurringByCurrency,
  upcomingChargesByCurrency,
} from '@/lib/billing';
import { relativeDayLabel, todayISO } from '@/lib/dates';
import { detectLeaks, LeakFindingUI } from '@/features/subscriptions/leaks-ui';
import { refreshSubscriptions, useDataStore } from '@/features/subscriptions/store';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellRing,
  CalendarClock,
  Droplets as DropletIcon,
  FlaskConical,
  PiggyBank,
  Plus,
  Wallet,
} from 'lucide-react-native';
import { Link, useRouter } from 'expo-router';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import type { Subscription } from '@/types';

function greeting(name: string | undefined): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}` : part;
}

export default function HomeScreen() {
  const router = useRouter();
  const { subscriptions, profile, status, error, isDemo } = useDataStore();
  const today = todayISO();

  const monthly = React.useMemo(() => monthlyRecurringByCurrency(subscriptions), [subscriptions]);
  const annual = React.useMemo(() => annualProjectionByCurrency(subscriptions), [subscriptions]);
  const upcoming7d = React.useMemo(() => upcomingChargesByCurrency(subscriptions, today, 7), [subscriptions, today]);

  const upcomingList = React.useMemo(() => {
    return subscriptions
      .filter((s) => contributesToRecurringSpend(s) && s.nextBillingDate)
      .map((s) => ({ sub: s, days: daysUntil(s.nextBillingDate!, today) }))
      .filter((x): x is { sub: Subscription; days: number } => x.days !== null && x.days >= 0)
      .sort((a, b) => a.days - b.days)
      .slice(0, 5);
  }, [subscriptions, today]);

  const leaks = React.useMemo(
    () =>
      detectLeaks({
        subscriptions,
        refISO: today,
        upcoming7dTotals: upcoming7d,
      }).slice(0, 3),
    [subscriptions, today, upcoming7d],
  );

  if (status === 'loading' || status === 'idle') return <LoadingSkeleton />;
  if (status === 'error') return <ErrorState message={error ?? undefined} onRetry={() => void refreshSubscriptions()} />;

  const hasSubs = subscriptions.some((s) => !s.archivedAt && s.status !== 'canceled');

  return (
    <Screen refreshing={false} onRefresh={() => void refreshSubscriptions()} edges={['top']}>
      {/* Header: greeting + profile + notifications */}
      <View className="flex-row items-center justify-between pt-4">
        <View className="flex-1">
          <Text variant="h4" className="font-bold">
            {greeting(profile?.displayName?.split(' ')[0])}
          </Text>
          <Text variant="muted">Here’s what’s leaving your wallet.</Text>
        </View>
        {isDemo ? (
          <View className="mr-2 flex-row items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1">
            <Icon as={FlaskConical} size={12} className="text-secondary-foreground" />
            <Text variant="small" className="font-semibold text-secondary-foreground">
              Demo
            </Text>
          </View>
        ) : null}
        <View className="flex-row items-center gap-2">
          <Link href="/reminders" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Upcoming reminders"
              className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card active:bg-accent"
            >
              <Icon as={Bell} size={18} className="text-foreground" />
              {upcomingList.some((x) => x.days <= 2) ? (
                <View
                  className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive"
                  accessibilityElementsHidden
                />
              ) : null}
            </Pressable>
          </Link>
          <Link href="/(tabs)/settings" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel="Profile and settings">
              <Avatar alt="Profile">
                <AvatarFallback className="bg-primary">
                  <Text className="font-semibold text-primary-foreground">
                    {(profile?.displayName ?? 'L').slice(0, 1).toUpperCase()}
                  </Text>
                </AvatarFallback>
              </Avatar>
            </Pressable>
          </Link>
        </View>
      </View>

      {hasSubs ? (
        <>
          {/* Financial overview */}
          <Card className="mt-5 gap-4 p-5">
            <View className="flex-row items-center justify-between">
              <Text variant="muted">Monthly recurring spend</Text>
              <Icon as={Wallet} size={18} className="text-muted-foreground" />
            </View>
            <CurrencyTotalsText totals={monthly} variant="h1" className="text-foreground" />
            <Separator />
            <View className="flex-row justify-between">
              <View className="gap-0.5">
                <Text variant="small" className="text-muted-foreground">
                  Projected annual
                </Text>
                <CurrencyTotalsText totals={annual} variant="large" className="text-lg" />
              </View>
              <View className="items-end gap-0.5">
                <View className="flex-row items-center gap-1">
                  <Text variant="small" className="text-muted-foreground">
                    Next 7 days
                  </Text>
                  <Text variant="small" className="italic text-muted-foreground">
                    forecast
                  </Text>
                </View>
                {upcoming7d.length > 0 ? (
                  <CurrencyTotalsText totals={upcoming7d} variant="large" className="text-lg text-warning" />
                ) : (
                  <Text variant="large" className="text-lg text-muted-foreground">
                    Nothing due
                  </Text>
                )}
              </View>
            </View>
          </Card>

          {/* Upcoming renewals */}
          <SectionHeader
            title="Upcoming charges"
            actionLabel="Calendar"
            onAction={() => router.push('/(tabs)/calendar')}
            icon={CalendarClock}
          />
          <Card>
            {upcomingList.length === 0 ? (
              <View className="gap-1 p-5">
                <Text className="font-semibold">No upcoming charges</Text>
                <Text variant="muted">
                  Nothing is due yet. Charges appear here as soon as your subscriptions have
                  billing dates.
                </Text>
              </View>
            ) : (
              upcomingList.map(({ sub, days }, index) => (
                <View key={sub.id}>
                  {index > 0 ? <Separator /> : null}
                  <Link href={`/subscription/${sub.id}`} asChild>
                    <Pressable
                      className="flex-row items-center gap-3 p-4 active:bg-accent/40"
                      accessibilityRole="button"
                      accessibilityLabel={`${sub.name}, charges ${relativeDayLabel(sub.nextBillingDate!, today) ?? ''}`}
                    >
                      <CategoryIcon category={sub.category} size={38} />
                      <View className="flex-1">
                        <Text className="font-semibold" numberOfLines={1}>
                          {sub.name}
                        </Text>
                        <Text variant="small" className="text-muted-foreground" numberOfLines={1}>
                          {relativeDayLabel(sub.nextBillingDate!, today)}
                          {sub.paymentMethodLabel ? ` · ${sub.paymentMethodLabel}` : ''}
                        </Text>
                      </View>
                      <View className="items-end gap-1">
                        <MoneyText amountCents={sub.amountCents} currency={sub.currency} variant="small" />
                        <UrgencyDot days={days} />
                      </View>
                    </Pressable>
                  </Link>
                </View>
              ))
            )}
          </Card>

          {/* Leak detection summary */}
          {leaks.length > 0 ? (
            <>
              <SectionHeader title="Leak detector" icon={AlertTriangle} />
              <Card className="gap-3 p-4">
                {leaks.map((leak) => (
                  <LeakFindingUI key={leak.id} finding={leak} />
                ))}
                <Button variant="secondary" size="sm" onPress={() => router.push('/(tabs)/insights')} accessibilityLabel="See all insights">
                  <Text>Review all insights</Text>
                  <Icon as={ArrowRight} size={16} className="text-secondary-foreground" />
                </Button>
              </Card>
            </>
          ) : null}

          {/* Quick actions */}
          <SectionHeader title="Quick actions" />
          <View className="flex-row flex-wrap gap-3">
            <QuickAction icon={Plus} label="Add subscription" onPress={() => router.push('/subscription/new')} />
            <QuickAction icon={BellRing} label="Review upcoming" onPress={() => router.push('/reminders')} />
            <QuickAction icon={PiggyBank} label="Review savings" onPress={() => router.push('/savings')} />
          </View>
        </>
      ) : (
        <View className="pt-10">
          <EmptyState
            icon={DropletIcon}
            title="Your money leaks start here."
            description="Add your first subscription to see upcoming charges and take control of recurring spending."
            actionLabel="Add your first subscription"
            onAction={() => router.push('/subscription/new')}
          />
          {isDemo ? null : (
            <Button variant="ghost" onPress={() => router.push('/(tabs)/insights')} accessibilityLabel="See how insights look">
              <Text className="text-muted-foreground">Or see how Insights works</Text>
            </Button>
          )}
        </View>
      )}
    </Screen>
  );
}

function daysUntil(dateISO: string, refISO: string): number | null {
  const ref = new Date(refISO + 'T00:00:00');
  const target = new Date(dateISO + 'T00:00:00');
  if (Number.isNaN(ref.getTime()) || Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - ref.getTime()) / 86_400_000);
}

/** Semantic urgency indicator: amber soon, red within 48h, with accessible text. */
function UrgencyDot({ days }: { days: number }) {
  if (days < 0) return null;
  const label = days <= 1 ? 'Very soon' : days <= 3 ? 'Soon' : days <= 7 ? 'This week' : null;
  if (!label) return null;
  const color = days <= 1 ? 'bg-destructive' : days <= 3 ? 'bg-warning' : 'bg-secondary';
  return (
    <View className="flex-row items-center gap-1.5" accessibilityLabel={`Due ${label.toLowerCase()}`}>
      <View className={`h-1.5 w-1.5 rounded-full ${color}`} />
      <Text variant="small" className="text-muted-foreground">
        {label}
      </Text>
    </View>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onAction,
  icon,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: Parameters<typeof Icon>[0]['as'];
}) {
  return (
    <View className="mt-7 flex-row items-center justify-between pb-1.5 pt-2">
      <View className="flex-row items-center gap-2">
        {icon ? <Icon as={icon} size={18} className="text-muted-foreground" /> : null}
        <Text variant="large">{title}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Text variant="small" className="font-semibold text-primary">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: Parameters<typeof Icon>[0]['as'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="min-w-[30%] flex-1 flex-row items-center gap-2 rounded-lg border border-border bg-card p-3 active:bg-accent"
    >
      <Icon as={icon} size={18} className="text-primary" />
      <Text variant="small" className="font-semibold">
        {label}
      </Text>
    </Pressable>
  );
}
