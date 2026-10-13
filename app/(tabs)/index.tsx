import { CategoryIcon } from '@/components/shared/category-icon';
import { ChartAreaInteractive } from '@/components/shared/chart-area-interactive';
import { CurrencyTotalsText, MoneyText } from '@/components/shared/money';
import { Screen } from '@/components/shared/screen';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared/state-views';
import { SubscriptionRow } from '@/components/shared/subscription-row';
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
import { FadeInView, LivePulseDot, ScaleOnPress } from '@/components/ui/motion';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/features/auth/auth-context';
import { computeInsights } from '@/features/insights/calculations';
import { detectLeaks, LeakFindingUI } from '@/features/subscriptions/leaks-ui';
import { refreshSubscriptions, useDataStore } from '@/features/subscriptions/store';
import {
  contributesToRecurringSpend,
  intervalLabel,
  upcomingChargesByCurrency,
} from '@/lib/billing';
import { categoryLabel } from '@/lib/constants';
import { daysBetween, formatDisplayDate, todayISO } from '@/lib/dates';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CreditCard,
  Layers,
  PiggyBank,
  Plus,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

export default function DashboardScreen() {
  const router = useRouter();
  const { enterDemoMode, dataMode } = useAuth();
  const { subscriptions, status, error, isDemo, profile } = useDataStore();
  const [seeding, setSeeding] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('renewals');
  const today = todayISO();

  const liveSubs = React.useMemo(
    () => subscriptions.filter((s) => !s.archivedAt),
    [subscriptions],
  );
  const activeSubs = React.useMemo(
    () => liveSubs.filter(contributesToRecurringSpend),
    [liveSubs],
  );

  const insights = React.useMemo(
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

  const upcoming30Totals = React.useMemo(
    () => upcomingChargesByCurrency(liveSubs, today, 30),
    [liveSubs, today],
  );

  const upcoming30List = React.useMemo(
    () =>
      activeSubs
        .filter((s) => {
          if (!s.nextBillingDate) return false;
          const d = daysBetween(today, s.nextBillingDate);
          return d !== null && d >= 0 && d <= 30;
        })
        .sort((a, b) => (a.nextBillingDate ?? '').localeCompare(b.nextBillingDate ?? '')),
    [activeSubs, today],
  );

  const upcoming7List = React.useMemo(
    () =>
      upcoming30List.filter((s) => {
        const d = s.nextBillingDate ? daysBetween(today, s.nextBillingDate) : null;
        return d !== null && d >= 0 && d <= 7;
      }),
    [upcoming30List, today],
  );

  const handleLoadSample = React.useCallback(async () => {
    setSeeding(true);
    try {
      await enterDemoMode();
    } finally {
      setSeeding(false);
    }
  }, [enterDemoMode]);

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
          message={error ?? 'Unable to load your subscriptions.'}
          onRetry={() => void refreshSubscriptions()}
        />
      </Screen>
    );
  }

  const primaryCurrency =
    profile?.preferredCurrency ?? insights.monthly[0]?.currency ?? 'USD';
  const totalCategoryPrimaryCents = insights.categorySpend.reduce(
    (acc, c) => acc + c.totalCentsInCurrency(primaryCurrency),
    0,
  );

  return (
    <TooltipProvider>
      <Screen className="gap-6">
        {/* Dashboard Page Header */}
        <FadeInView delay={0} className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="gap-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-2xl font-semibold tracking-tight text-foreground">
                Overview
              </Text>
              <Badge variant="outline" className="gap-1.5">
                <LivePulseDot tone="success" size={6} />
                <Text>
                  {activeSubs.length === 0
                    ? 'No active plans'
                    : `${activeSubs.length} active`}
                </Text>
              </Badge>
              {isDemo || dataMode === 'demo' ? (
                <Badge variant="secondary">
                  <Text>Sample data</Text>
                </Badge>
              ) : null}
            </View>
            <Text className="text-sm text-muted-foreground">
              Recurring subscription spend, upcoming renewals, and leak detection.
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => router.push('/savings')}
                  accessibilityLabel="Savings opportunities"
                >
                  <Icon as={PiggyBank} size={15} className="text-foreground" />
                  <Text>Savings</Text>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <Text className="text-xs text-background">
                  Audit overlapping subscriptions & cancellation candidates
                </Text>
              </TooltipContent>
            </Tooltip>

            <Button
              size="sm"
              onPress={() => router.push('/subscription/new')}
              accessibilityLabel="Add subscription"
            >
              <Icon as={Plus} size={15} className="text-primary-foreground" />
              <Text>Add subscription</Text>
            </Button>
          </View>
        </FadeInView>

        {liveSubs.length === 0 ? (
          <FadeInView delay={80} className="gap-4">
            <EmptyState
              icon={CreditCard}
              title="Track your first subscription"
              description="Add Netflix, Spotify, iCloud, gym memberships, or SaaS tools to uncover hidden leaks and renewal alerts."
              actionLabel="Add subscription"
              onAction={() => router.push('/subscription/new')}
            />

            <Alert>
              <Icon as={Sparkles} size={16} className="text-foreground" />
              <AlertTitle>Quick evaluation mode</AlertTitle>
              <AlertDescription>
                Load sample data to populate realistic recurring services, category charts, and
                savings recommendations in one tap.
              </AlertDescription>
              <View className="mt-3 flex-row">
                <Button
                  variant="outline"
                  size="sm"
                  loading={seeding}
                  onPress={() => void handleLoadSample()}
                >
                  <Text>Load sample data</Text>
                </Button>
              </View>
            </Alert>
          </FadeInView>
        ) : (
          <>
            {/* SectionCards (shadcn dashboard-01 4-card KPI grid) */}
            <FadeInView delay={60} className="gap-3 sm:flex-row sm:flex-wrap">
              <Card className="w-full gap-3 sm:min-w-[210px] sm:flex-1">
                <CardHeader>
                  <CardDescription className="text-xs font-medium">
                    Monthly Spend
                  </CardDescription>
                  <CurrencyTotalsText
                    totals={insights.monthly}
                    className="text-2xl font-semibold tracking-tight text-foreground"
                  />
                  <CardAction>
                    <Badge variant="outline" className="gap-1">
                      <Icon as={TrendingUp} size={12} className="text-foreground" />
                      <Text>{activeSubs.length} active</Text>
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1 pt-0">
                  <Text className="text-xs font-medium text-foreground">
                    Normalized 30-day run rate
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {insights.trialsEnding.length > 0
                      ? `Includes ${insights.trialsEnding.length} trial${insights.trialsEnding.length === 1 ? '' : 's'} ending soon`
                      : 'Across all active billing cycles'}
                  </Text>
                </CardFooter>
              </Card>

              <Card className="w-full gap-3 sm:min-w-[210px] sm:flex-1">
                <CardHeader>
                  <CardDescription className="text-xs font-medium">
                    Annual Run-Rate
                  </CardDescription>
                  <CurrencyTotalsText
                    totals={insights.annual}
                    className="text-2xl font-semibold tracking-tight text-foreground"
                  />
                  <CardAction>
                    <Badge variant="secondary">
                      <Text>12 mo</Text>
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1 pt-0">
                  <Text className="text-xs font-medium text-foreground">
                    Projected 12-month commitment
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Based on active recurring plans
                  </Text>
                </CardFooter>
              </Card>

              <Card className="w-full gap-3 sm:min-w-[210px] sm:flex-1">
                <CardHeader>
                  <CardDescription className="text-xs font-medium">
                    Due in 30 Days
                  </CardDescription>
                  <CurrencyTotalsText
                    totals={upcoming30Totals}
                    placeholder="$0.00"
                    className="text-2xl font-semibold tracking-tight text-foreground"
                  />
                  <CardAction>
                    <Badge
                      variant={upcoming7List.length > 0 ? 'warning' : 'outline'}
                      className="gap-1"
                    >
                      {upcoming7List.length > 0 ? (
                        <LivePulseDot tone="warning" size={5} />
                      ) : (
                        <Icon as={CalendarClock} size={12} className="text-foreground" />
                      )}
                      <Text>{upcoming7List.length} this wk</Text>
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1 pt-0">
                  <Text className="text-xs font-medium text-foreground">
                    {upcoming30List.length} upcoming charge{upcoming30List.length === 1 ? '' : 's'}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {upcoming7List.length > 0
                      ? `${upcoming7List.length} renewing within 7 days`
                      : 'No urgent renewals in the next 7 days'}
                  </Text>
                </CardFooter>
              </Card>

              <ScaleOnPress
                scaleTo={0.985}
                onPress={() => router.push('/savings')}
                className="w-full sm:min-w-[210px] sm:flex-1"
              >
                <Card className="gap-3 web:hover:border-foreground/30">
                  <CardHeader>
                    <CardDescription className="text-xs font-medium">
                      Potential Savings
                    </CardDescription>
                    <CurrencyTotalsText
                      totals={insights.potentialSavings}
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
                  <CardFooter className="flex-col items-start gap-1 pt-0">
                    <View className="flex-row items-center gap-1">
                      <Text className="text-xs font-medium text-foreground">
                        Open savings audit
                      </Text>
                      <Icon as={ArrowUpRight} size={12} className="text-muted-foreground" />
                    </View>
                    <Text className="text-xs text-muted-foreground">
                      Estimated monthly leak reduction
                    </Text>
                  </CardFooter>
                </Card>
              </ScaleOnPress>
            </FadeInView>

            {/* Renewal Alert Banner */}
            {upcoming7List.length > 0 ? (
              <FadeInView delay={110}>
                <Alert className="border-warning/40 bg-warning/5">
                  <Icon as={AlertTriangle} size={16} className="text-warning" />
                  <AlertTitle>
                    {upcoming7List.length} subscription
                    {upcoming7List.length === 1 ? '' : 's'} renewing within 7 days
                  </AlertTitle>
                  <AlertDescription>
                    Review upcoming charges before your billing date to cancel trials or unwanted
                    renewals in time.
                  </AlertDescription>
                </Alert>
              </FadeInView>
            ) : null}

            {/* Official shadcn/ui dashboard-01 ChartAreaInteractive */}
            <FadeInView delay={150}>
              <ChartAreaInteractive
                subscriptions={liveSubs}
                preferredCurrency={primaryCurrency}
              />
            </FadeInView>

            {/* Main Dashboard Tabs (shadcn dashboard-01 Tabs + Table + Cards) */}
            <FadeInView delay={210}>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <TabsList>
                    <TabsTrigger value="renewals">
                      <Text>Upcoming ({upcoming30List.length})</Text>
                    </TabsTrigger>
                    <TabsTrigger value="leaks">
                      <Text>Leak Signals ({leaks.length})</Text>
                    </TabsTrigger>
                    <TabsTrigger value="table">
                      <Text>All Plans ({liveSubs.length})</Text>
                    </TabsTrigger>
                    <TabsTrigger value="categories">
                      <Text>Categories ({insights.categorySpend.length})</Text>
                    </TabsTrigger>
                  </TabsList>

                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => router.push('/(tabs)/subscriptions')}
                  >
                    <Text>Manage all</Text>
                    <Icon as={ArrowUpRight} size={14} className="text-muted-foreground" />
                  </Button>
                </View>

                <TabsContent value="renewals" className="gap-4">
                  <Card className="py-5">
                    <CardHeader className="px-5">
                      <CardTitle className="text-base">Next 30 Days</CardTitle>
                      <CardDescription>
                        Active and trial subscriptions renewing in the next 30 days.
                      </CardDescription>
                      <CardAction className="right-5">
                        <Button
                          variant="ghost"
                          size="xs"
                          onPress={() => router.push('/(tabs)/calendar')}
                        >
                          <Text>Calendar</Text>
                          <Icon as={ArrowUpRight} size={13} className="text-muted-foreground" />
                        </Button>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="px-5">
                      {upcoming30List.length === 0 ? (
                        <View className="items-center gap-1 rounded-lg border border-dashed border-border py-8">
                          <Text className="text-sm font-medium text-foreground">
                            No renewals due in the next 30 days
                          </Text>
                          <Text className="text-xs text-muted-foreground">
                            You are clear of upcoming charges this month.
                          </Text>
                        </View>
                      ) : (
                        <ItemGroup className="gap-2">
                          {upcoming30List.slice(0, 6).map((sub) => (
                            <SubscriptionRow key={sub.id} subscription={sub} />
                          ))}
                        </ItemGroup>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="leaks">
                  <Card className="py-5">
                    <CardHeader className="px-5">
                      <CardTitle className="text-base">Detected Leak Signals</CardTitle>
                      <CardDescription>
                        Duplicate category overlaps, price increases, and trials expiring soon.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-5">
                      {leaks.length === 0 ? (
                        <View className="items-center gap-1 rounded-lg border border-dashed border-border py-8">
                          <Text className="text-sm font-medium text-foreground">
                            No leak signals detected
                          </Text>
                          <Text className="text-xs text-muted-foreground">
                            Your recurring subscriptions look clean.
                          </Text>
                        </View>
                      ) : (
                        <ItemGroup className="gap-2">
                          {leaks.slice(0, 5).map((finding) => (
                            <LeakFindingUI key={finding.id} finding={finding} />
                          ))}
                        </ItemGroup>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="table">
                  <Card className="overflow-hidden py-0">
                    <CardHeader className="border-b border-border px-5 py-4">
                      <CardTitle className="text-base">Subscription Ledger</CardTitle>
                      <CardDescription>
                        Structured overview of recurring plans, cycles, and renewal dates.
                      </CardDescription>
                    </CardHeader>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="flex-[1.6]">
                            <Text>Service</Text>
                          </TableHead>
                          <TableHead className="hidden sm:flex">
                            <Text>Status</Text>
                          </TableHead>
                          <TableHead className="hidden md:flex">
                            <Text>Cycle</Text>
                          </TableHead>
                          <TableHead>
                            <Text>Next Renewal</Text>
                          </TableHead>
                          <TableHead className="items-end">
                            <Text>Amount</Text>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {liveSubs.slice(0, 8).map((sub) => {
                          const d = sub.nextBillingDate
                            ? daysBetween(today, sub.nextBillingDate)
                            : null;
                          return (
                            <Pressable
                              key={sub.id}
                              onPress={() => router.push(`/subscription/${sub.id}`)}
                            >
                              <TableRow>
                                <TableCell className="flex-[1.6] flex-row items-center gap-2.5">
                                  <CategoryIcon category={sub.category} size={30} />
                                  <View className="flex-1">
                                    <Text
                                      numberOfLines={1}
                                      className="text-sm font-medium text-foreground"
                                    >
                                      {sub.name}
                                    </Text>
                                    {sub.paymentMethodLabel ? (
                                      <Text
                                        numberOfLines={1}
                                        className="text-xs text-muted-foreground"
                                      >
                                        {sub.paymentMethodLabel}
                                      </Text>
                                    ) : null}
                                  </View>
                                </TableCell>
                                <TableCell className="hidden sm:flex">
                                  <Badge
                                    variant={
                                      sub.status === 'active'
                                        ? 'outline'
                                        : sub.status === 'trialing'
                                          ? 'warning'
                                          : 'secondary'
                                    }
                                  >
                                    <Text>{sub.status}</Text>
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden md:flex">
                                  <Text className="text-xs text-muted-foreground">
                                    {intervalLabel(sub.interval)}
                                  </Text>
                                </TableCell>
                                <TableCell>
                                  <Text
                                    className={
                                      d !== null &&
                                      d >= 0 &&
                                      d <= 3 &&
                                      sub.status !== 'canceled'
                                        ? 'text-xs font-medium text-warning'
                                        : 'text-xs text-muted-foreground'
                                    }
                                  >
                                    {sub.status === 'canceled'
                                      ? '—'
                                      : formatDisplayDate(sub.nextBillingDate)}
                                  </Text>
                                </TableCell>
                                <TableCell className="items-end">
                                  <MoneyText
                                    amountCents={sub.amountCents}
                                    currency={sub.currency}
                                    className="text-sm font-semibold text-foreground"
                                  />
                                </TableCell>
                              </TableRow>
                            </Pressable>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Card>
                </TabsContent>

                <TabsContent value="categories">
                  <Card className="py-5">
                    <CardHeader className="px-5">
                      <CardTitle className="text-base">Spend by Category</CardTitle>
                      <CardDescription>
                        Normalized monthly distribution across your top categories.
                      </CardDescription>
                      <CardAction className="right-5">
                        <Button
                          variant="ghost"
                          size="xs"
                          onPress={() => router.push('/(tabs)/insights')}
                        >
                          <Icon as={Layers} size={13} className="text-muted-foreground" />
                          <Text>Full breakdown</Text>
                        </Button>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="gap-4 px-5">
                      {insights.categorySpend.slice(0, 5).map((item) => {
                        const primaryVal = item.totalCentsInCurrency(primaryCurrency);
                        const pct =
                          totalCategoryPrimaryCents > 0
                            ? Math.round((primaryVal / totalCategoryPrimaryCents) * 100)
                            : 0;
                        return (
                          <View key={item.category} className="gap-2">
                            <View className="flex-row items-center justify-between">
                              <View className="flex-row items-center gap-2.5">
                                <CategoryIcon category={item.category} size={30} />
                                <Text className="text-sm font-medium text-foreground">
                                  {categoryLabel(item.category)}
                                </Text>
                                <Badge variant="secondary">
                                  <Text>{item.subscriptionIds.length}</Text>
                                </Badge>
                              </View>
                              <View className="flex-row items-center gap-2">
                                <CurrencyTotalsText
                                  totals={item.amounts}
                                  className="text-sm font-semibold text-foreground"
                                />
                                <Text className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                                  {pct}%
                                </Text>
                              </View>
                            </View>
                            <Progress value={pct} />
                          </View>
                        );
                      })}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </FadeInView>
          </>
        )}
      </Screen>
    </TooltipProvider>
  );
}
