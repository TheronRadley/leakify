import { CategoryIcon } from '@/components/shared/category-icon';
import { ChartAreaInteractive } from '@/components/shared/chart-area-interactive';
import { CurrencyTotalsText, MoneyText } from '@/components/shared/money';
import { Screen } from '@/components/shared/screen';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared/state-views';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { ItemGroup } from '@/components/ui/item';
import { FadeInView, ScaleOnPress } from '@/components/ui/motion';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { computeInsights } from '@/features/insights/calculations';
import { detectLeaks, LeakFindingUI } from '@/features/subscriptions/leaks-ui';
import { refreshSubscriptions, useDataStore } from '@/features/subscriptions/store';
import {
  annualEquivalentCents,
  contributesToRecurringSpend,
  intervalLabel,
  monthlyEquivalentCents,
  upcomingChargesByCurrency,
} from '@/lib/billing';
import { categoryLabel } from '@/lib/constants';
import { todayISO } from '@/lib/dates';
import { useRouter } from 'expo-router';
import {
  ArrowUpRight,
  BarChart3,
  Layers,
  PiggyBank,
  Sparkles,
  TrendingDown,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

export default function InsightsScreen() {
  const router = useRouter();
  const { subscriptions, status, error, profile } = useDataStore();
  const [tab, setTab] = React.useState('categories');
  const today = todayISO();

  const liveSubs = React.useMemo(
    () => subscriptions.filter((s) => !s.archivedAt),
    [subscriptions],
  );
  const activeSubs = React.useMemo(
    () => liveSubs.filter(contributesToRecurringSpend),
    [liveSubs],
  );

  const summary = React.useMemo(
    () => computeInsights(liveSubs, today),
    [liveSubs, today],
  );
  const leaks = React.useMemo(
    () =>
      detectLeaks({
        subscriptions: liveSubs,
        refISO: today,
        upcoming7dTotals: upcomingChargesByCurrency(liveSubs, today, 7),
      }),
    [liveSubs, today],
  );

  if (status === 'loading' || status === 'idle') {
    return (
      <Screen>
        <LoadingSkeleton cards={4} />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen>
        <ErrorState
          message={error ?? 'Unable to compute insights.'}
          onRetry={() => void refreshSubscriptions()}
        />
      </Screen>
    );
  }

  if (liveSubs.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon={BarChart3}
          title="No insights yet"
          description="Add a couple of subscriptions to unlock spending breakdowns, top drains, and savings suggestions."
          actionLabel="Add subscription"
          onAction={() => router.push('/subscription/new')}
        />
      </Screen>
    );
  }

  const primaryCurrency =
    profile?.preferredCurrency ?? summary.monthly[0]?.currency ?? 'USD';
  const totalCategoryPrimaryCents = summary.categorySpend.reduce(
    (acc, c) => acc + c.totalCentsInCurrency(primaryCurrency),
    0,
  );

  return (
    <Screen className="gap-6">
      <FadeInView delay={0} className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="gap-1">
          <Text className="text-2xl font-semibold tracking-tight text-foreground">
            Insights
          </Text>
          <Text className="text-sm text-muted-foreground">
            Where your recurring money goes — normalized to monthly and annual run-rates.
          </Text>
        </View>
        <Button variant="outline" size="sm" onPress={() => router.push('/savings')}>
          <Icon as={PiggyBank} size={15} className="text-foreground" />
          <Text>Savings audit</Text>
          <Icon as={ArrowUpRight} size={13} className="text-muted-foreground" />
        </Button>
      </FadeInView>

      {/* Top KPI Cards */}
      <FadeInView delay={60} className="gap-3 sm:flex-row sm:flex-wrap">
        <Card className="w-full gap-3 sm:min-w-[200px] sm:flex-1">
          <CardHeader>
            <CardDescription className="text-xs font-medium">
              Monthly Run-Rate
            </CardDescription>
            <CurrencyTotalsText
              totals={summary.monthly}
              className="text-2xl font-semibold tracking-tight text-foreground"
            />
            <CardAction>
              <Badge variant="outline">
                <Text>{activeSubs.length} active</Text>
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="pt-0">
            <Text className="text-xs text-muted-foreground">
              Normalized 30-day recurring spend
            </Text>
          </CardFooter>
        </Card>

        <Card className="w-full gap-3 sm:min-w-[200px] sm:flex-1">
          <CardHeader>
            <CardDescription className="text-xs font-medium">
              Annual Projection
            </CardDescription>
            <CurrencyTotalsText
              totals={summary.annual}
              className="text-2xl font-semibold tracking-tight text-foreground"
            />
            <CardAction>
              <Badge variant="secondary">
                <Text>12 mo</Text>
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="pt-0">
            <Text className="text-xs text-muted-foreground">
              Full year commitment across all cycles
            </Text>
          </CardFooter>
        </Card>

        <ScaleOnPress
          scaleTo={0.985}
          onPress={() => router.push('/savings')}
          className="w-full sm:min-w-[200px] sm:flex-1"
        >
          <Card className="gap-3 web:hover:border-foreground/30">
            <CardHeader>
              <CardDescription className="text-xs font-medium">
                Savings Found
              </CardDescription>
              <CurrencyTotalsText
                totals={summary.potentialSavings}
                placeholder="$0.00"
                className="text-2xl font-semibold tracking-tight text-success"
              />
              <CardAction>
                <Badge variant="success" className="gap-1">
                  <Icon as={TrendingDown} size={12} className="text-success" />
                  <Text>{leaks.length} signals</Text>
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="pt-0">
              <Text className="text-xs text-muted-foreground">
                Estimated monthly savings from audit
              </Text>
            </CardFooter>
          </Card>
        </ScaleOnPress>
      </FadeInView>

      {/* Interactive Area Chart */}
      <FadeInView delay={120}>
        <ChartAreaInteractive
          subscriptions={liveSubs}
          preferredCurrency={primaryCurrency}
        />
      </FadeInView>

      <FadeInView delay={180}>
        <Tabs value={tab} onValueChange={setTab} className="gap-4">
          <TabsList className="self-start">
            <TabsTrigger value="categories">
              <Text>By Category ({summary.categorySpend.length})</Text>
            </TabsTrigger>
            <TabsTrigger value="drains">
              <Text>Biggest Drains ({summary.largest.length})</Text>
            </TabsTrigger>
            <TabsTrigger value="savings">
              <Text>Leak Signals ({leaks.length})</Text>
            </TabsTrigger>
          </TabsList>

          {/* Category Breakdown */}
          <TabsContent value="categories">
            <Card className="py-5">
              <CardHeader className="px-5">
                <CardTitle className="text-base">Category Distribution</CardTitle>
                <CardDescription>
                  Share of monthly recurring spend grouped by service category.
                </CardDescription>
              </CardHeader>
              <CardContent className="gap-4 px-5">
                {summary.categorySpend.length === 0 ? (
                  <Text className="text-sm text-muted-foreground">
                    No active subscriptions to break down.
                  </Text>
                ) : (
                  summary.categorySpend.map((item) => {
                    const primaryVal = item.totalCentsInCurrency(primaryCurrency);
                    const pct =
                      totalCategoryPrimaryCents > 0
                        ? Math.round((primaryVal / totalCategoryPrimaryCents) * 100)
                        : 0;
                    const yearlyTotals = item.amounts.map((a) => ({
                      currency: a.currency,
                      amountCents: a.amountCents * 12,
                    }));
                    return (
                      <View
                        key={item.category}
                        className="gap-2 rounded-lg border border-border p-3.5"
                      >
                        <View className="flex-row items-center justify-between gap-2">
                          <View className="flex-row items-center gap-2.5">
                            <CategoryIcon category={item.category} size={32} />
                            <View>
                              <Text className="text-sm font-medium text-foreground">
                                {categoryLabel(item.category)}
                              </Text>
                              <Text className="text-xs text-muted-foreground">
                                {item.subscriptionIds.length}{' '}
                                {item.subscriptionIds.length === 1
                                  ? 'subscription'
                                  : 'subscriptions'}
                              </Text>
                            </View>
                          </View>
                          <View className="items-end">
                            <CurrencyTotalsText
                              totals={item.amounts}
                              className="text-sm font-semibold text-foreground"
                            />
                            <CurrencyTotalsText
                              totals={yearlyTotals}
                              className="text-xs text-muted-foreground"
                            />
                          </View>
                        </View>
                        <View className="flex-row items-center gap-2.5">
                          <View className="flex-1">
                            <Progress value={pct} />
                          </View>
                          <Badge variant="outline" className="min-w-11 justify-center">
                            <Text>{pct}%</Text>
                          </Badge>
                        </View>
                      </View>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Biggest Drains Table */}
          <TabsContent value="drains">
            <Card className="overflow-hidden py-0">
              <CardHeader className="border-b border-border px-5 py-4">
                <CardTitle className="text-base">Highest Recurring Drains</CardTitle>
                <CardDescription>
                  Ranked by normalized monthly and annual cost impact.
                </CardDescription>
              </CardHeader>
              {summary.largest.length === 0 ? (
                <CardContent className="p-5">
                  <Text className="text-sm text-muted-foreground">
                    No active subscriptions yet.
                  </Text>
                </CardContent>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="max-w-12">
                        <Text>#</Text>
                      </TableHead>
                      <TableHead className="flex-[1.6]">
                        <Text>Service</Text>
                      </TableHead>
                      <TableHead className="hidden sm:flex">
                        <Text>Cycle</Text>
                      </TableHead>
                      <TableHead className="items-end">
                        <Text>Monthly</Text>
                      </TableHead>
                      <TableHead className="items-end">
                        <Text>Yearly</Text>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.largest.map((sub, index) => {
                      const monthly = monthlyEquivalentCents(sub.amountCents, sub.interval);
                      const yearly = annualEquivalentCents(sub.amountCents, sub.interval);
                      return (
                        <Pressable
                          key={sub.id}
                          onPress={() => router.push(`/subscription/${sub.id}`)}
                        >
                          <TableRow>
                            <TableCell className="max-w-12">
                              <Badge variant="secondary">
                                <Text>{index + 1}</Text>
                              </Badge>
                            </TableCell>
                            <TableCell className="flex-[1.6] flex-row items-center gap-2.5">
                              <CategoryIcon category={sub.category} size={30} />
                              <Text
                                numberOfLines={1}
                                className="flex-1 text-sm font-medium text-foreground"
                              >
                                {sub.name}
                              </Text>
                            </TableCell>
                            <TableCell className="hidden sm:flex">
                              <Text className="text-xs text-muted-foreground">
                                {intervalLabel(sub.interval)}
                              </Text>
                            </TableCell>
                            <TableCell className="items-end">
                              <MoneyText
                                amountCents={monthly}
                                currency={sub.currency}
                                className="text-sm font-semibold text-foreground"
                              />
                            </TableCell>
                            <TableCell className="items-end">
                              <MoneyText
                                amountCents={yearly}
                                currency={sub.currency}
                                className="text-xs text-muted-foreground"
                              />
                            </TableCell>
                          </TableRow>
                        </Pressable>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>

          {/* Leak Signals Tab */}
          <TabsContent value="savings" className="gap-4">
            <Alert>
              <Icon as={Sparkles} size={16} className="text-foreground" />
              <AlertTitle>Automated Leak Audit</AlertTitle>
              <AlertDescription>
                Leakify detects duplicate category subscriptions, price increases, unused plans,
                and trials nearing paid conversion.
              </AlertDescription>
            </Alert>

            {leaks.length === 0 ? (
              <Card className="py-5">
                <CardContent className="items-center gap-2 px-5 py-6">
                  <Icon as={Layers} size={20} className="text-muted-foreground" />
                  <Text className="text-sm font-medium text-foreground">
                    Your recurring stack looks lean
                  </Text>
                  <Text className="text-center text-xs text-muted-foreground">
                    No obvious duplicate categories or high-cost monthly leaks detected right now.
                  </Text>
                </CardContent>
              </Card>
            ) : (
              <ItemGroup className="gap-2.5">
                {leaks.map((finding) => (
                  <LeakFindingUI key={finding.id} finding={finding} />
                ))}
              </ItemGroup>
            )}
          </TabsContent>
        </Tabs>
      </FadeInView>
    </Screen>
  );
}
