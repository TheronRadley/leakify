import { CategoryIcon } from '@/components/shared/category-icon';
import { CurrencyTotalsText, MoneyText } from '@/components/shared/money';
import { Screen } from '@/components/shared/screen';
import { EmptyState, LoadingSkeleton } from '@/components/shared/state-views';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { computeInsights, computeSpendTrend, type TrendPoint } from '@/features/insights/calculations';
import { detectLeaks, LeakFindingUI } from '@/features/subscriptions/leaks-ui';
import { listAllBillingEvents, useDataStore, useSubscriptions } from '@/features/subscriptions/store';
import { intervalLabel, monthlyEquivalentCents } from '@/lib/billing';
import { categoryLabel } from '@/lib/constants';
import { formatDisplayDate, relativeDayLabel, todayISO } from '@/lib/dates';
import { useRouter } from 'expo-router';
import { BarChart3, PiggyBank, TrendingUp } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import type { CurrencyCode } from '@/types';

export default function InsightsScreen() {
  const router = useRouter();
  const { subscriptions, status } = useSubscriptions();
  const store = useDataStore();
  const today = todayISO();

  const insights = React.useMemo(() => computeInsights(subscriptions, today), [subscriptions, today]);
  const findings = React.useMemo(() => {
    const upcoming = insights.upcomingClusters[0]?.totals ?? [];
    return detectLeaks({ subscriptions, refISO: today, upcoming7dTotals: upcoming });
  }, [subscriptions, insights, today]);

  // Specified-historical trend from payments the user actually recorded.
  const [trend, setTrend] = React.useState<TrendPoint[]>([]);
  const [trendLoaded, setTrendLoaded] = React.useState(false);
  React.useEffect(() => {
    let mounted = true;
    if (status === 'ready') {
      listAllBillingEvents()
        .then((events) => {
          if (!mounted) return;
          setTrend(computeSpendTrend(events, today));
          setTrendLoaded(true);
        })
        .catch(() => mounted && setTrendLoaded(true));
    }
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when the record set changes
  }, [status, subscriptions]);

  if (status === 'loading' || status === 'idle') return <LoadingSkeleton />;

  if (!insights.hasEnoughData) {
    return (
      <Screen edges={['top']}>
        <Text variant="h3" className="pb-2 pt-14 text-center">
          No insights yet
        </Text>
        <EmptyState
          icon={BarChart3}
          title="Insights need data"
          description="Once you track at least one subscription, this screen shows where your money goes monthly and what to review."
          actionLabel="Add a subscription"
          onAction={() => router.push('/subscription/new')}
        />
      </Screen>
    );
  }

  const primaryCurrency = store.profile?.preferredCurrency ?? insights.monthly[0]?.currency ?? 'USD';
  const maxCategoryCents = Math.max(
    ...insights.categorySpend.map((c) => c.amounts[0]?.amountCents ?? 0),
    1,
  );

  return (
    <Screen edges={['top']}>
      <Text variant="h3" className="pt-4">
        Insights
      </Text>
      <Text variant="muted" className="pb-4">
        Built only from data you recorded. Nothing is estimated from bank access.
      </Text>

      {/* Headline metrics */}
      <View className="flex-row gap-3">
        <MetricCard label="Per month" totals={insights.monthly} />
        <MetricCard label="Per year (projected)" totals={insights.annual} />
      </View>

      {/* Potential savings */}
      {insights.potentialSavings.length > 0 ? (
        <Card className="mt-3 gap-2 border-primary/40 bg-accent p-4">
          <View className="flex-row items-center gap-2">
            <Icon as={PiggyBank} size={18} className="text-primary" />
            <Text className="font-semibold">Potential savings</Text>
          </View>
          <View className="flex-row items-baseline gap-1">
            <CurrencyTotalsText totals={insights.potentialSavings} variant="h3" className="text-primary" />
            <Text variant="muted">/month if you cancel your flagged candidates</Text>
          </View>
          <Text variant="small" className="leading-4 text-muted-foreground">
            Estimate from the recorded recurring amounts — not money saved yet. Savings only
            become real once a cancellation is confirmed.
          </Text>
          <Button size="sm" onPress={() => router.push('/savings')} accessibilityLabel="Review potential savings">
            <Text>Review potential savings</Text>
          </Button>
        </Card>
      ) : null}

      {/* Spending by category */}
      <Text variant="large" className="pb-2 pt-6">
        Spending by category
      </Text>
      <Card className="gap-3 p-4">
        {insights.categorySpend.map((row) => {
          const primary = row.amounts.find((a) => a.currency === primaryCurrency) ?? row.amounts[0];
          const widthPct = Math.max(4, Math.round(((primary?.amountCents ?? 0) / maxCategoryCents) * 100));
          return (
            <View key={row.category} className="gap-1.5" accessibilityLabel={`${categoryLabel(row.category)}: ${row.amounts.length} currencies tracked`}>
              <View className="flex-row items-center gap-2">
                <CategoryIcon category={row.category} size={26} />
                <Text className="flex-1 font-medium" numberOfLines={1}>
                  {categoryLabel(row.category)}
                </Text>
                <CurrencyTotalsText totals={row.amounts} variant="small" />
                <Text variant="small" className="text-muted-foreground">
                  /mo
                </Text>
              </View>
              <View className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <View className="h-full rounded-full bg-primary" style={{ width: `${widthPct}%` }} />
              </View>
            </View>
          );
        })}
      </Card>

      {/* Largest subscriptions */}
      <Text variant="large" className="pb-2 pt-6">
        Largest subscriptions
      </Text>
      <Card>
        {insights.largest.map((sub, index) => (
          <View key={sub.id}>
            {index > 0 ? <Separator /> : null}
            <Button
              variant="ghost"
              className="h-auto flex-row items-center gap-3 justify-start px-4 py-3"
              onPress={() => router.push(`/subscription/${sub.id}`)}
              accessibilityLabel={`${sub.name}, largest subscription number ${index + 1}`}
            >
              <Text variant="small" className="w-5 text-muted-foreground">
                {index + 1}
              </Text>
              <CategoryIcon category={sub.category} size={30} />
              <View className="flex-1 items-start">
                <Text className="font-semibold" numberOfLines={1}>
                  {sub.name}
                </Text>
                <Text variant="small" className="text-muted-foreground">
                  {intervalLabel(sub.interval)}
                </Text>
              </View>
              <MoneyText
                amountCents={monthlyEquivalentCents(sub.amountCents, sub.interval)}
                currency={sub.currency as CurrencyCode}
                variant="small"
              />
            </Button>
          </View>
        ))}
      </Card>

      {/* Renewal clusters */}
      {insights.upcomingClusters.length > 0 ? (
        <>
          <Text variant="large" className="pb-2 pt-6">
            Upcoming renewal clusters
          </Text>
          <View className="gap-2">
            {insights.upcomingClusters.map((cluster) => (
              <Card key={cluster.startISO} className="flex-row items-center gap-3 p-4">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-warning/15">
                  <Icon as={TrendingUp} size={18} className="text-warning" />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold">{cluster.label}</Text>
                  <Text variant="small" className="text-muted-foreground">
                    {cluster.count} renewal{cluster.count === 1 ? '' : 's'} ·{' '}
                    {relativeDayLabel(cluster.startISO, today) ?? formatDisplayDate(cluster.startISO)}
                  </Text>
                </View>
                <CurrencyTotalsText totals={cluster.totals} variant="small" />
              </Card>
            ))}
          </View>
        </>
      ) : null}

      {/* Historical trend (only when the user has recorded ≥ 2 payments) */}
      {trendLoaded && trend.some((p) => p.count > 0) ? (
        <>
          <Text variant="large" className="pb-2 pt-6">
            Recorded spending trend
          </Text>
          <Card className="gap-3 p-4">
            <View className="h-32 flex-row items-end gap-2">
              {(() => {
                const max = Math.max(...trend.map((p) => sumFirst(p)), 1);
                return trend.map((point) => {
                  const height = Math.max(sumFirst(point) > 0 ? 4 : 1, Math.round((sumFirst(point) / max) * 100));
                  return (
                    <View key={point.key} className="flex-1 items-center gap-1">
                      <View className="h-24 w-full items-center justify-end">
                        <View
                          accessibilityLabel={`${point.label}: ${point.count} recorded payments`}
                          className={`w-full rounded-t-md ${sumFirst(point) > 0 ? 'bg-primary' : 'bg-muted'}`}
                          style={{ height: `${height}%` }}
                        />
                      </View>
                      <Text variant="small" className="text-muted-foreground">
                        {point.label}
                      </Text>
                    </View>
                  );
                });
              })()}
            </View>
            <Text variant="small" className="leading-4 text-muted-foreground">
              Based on payments you recorded (“Record payment”), last 6 months
              {trend[0] ? ` (${trend[0].label} – ${trend[trend.length - 1].label})` : ''}. Not a bank
              feed.
            </Text>
          </Card>
        </>
      ) : null}

      {/* Leak findings */}
      {findings.length > 0 ? (
        <>
          <Text variant="large" className="pb-2 pt-6">
            Worth reviewing
          </Text>
          <View className="gap-2">
            {findings.map((finding) => (
              <LeakFindingUI key={finding.id} finding={finding} />
            ))}
          </View>
        </>
      ) : (
        <Card className="mt-6 gap-1 p-4">
          <Text className="font-semibold">Nothing flags your attention</Text>
          <Text variant="muted">
            No duplicate candidates, expiring trials or missing billing dates found in your
            tracked subscriptions.
          </Text>
        </Card>
      )}
    </Screen>
  );
}

function sumFirst(point: TrendPoint): number {
  return point.totals.reduce((acc, t) => acc + t.amountCents, 0);
}

function MetricCard({
  label,
  totals,
}: {
  label: string;
  totals: { currency: CurrencyCode; amountCents: number }[];
}) {
  return (
    <Card className="flex-1 gap-1 p-4">
      <Text variant="small" className="text-muted-foreground">
        {label}
      </Text>
      <CurrencyTotalsText totals={totals} variant="large" className="text-xl" placeholder="—" />
    </Card>
  );
}
