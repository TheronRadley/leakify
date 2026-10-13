import { CurrencyTotalsText, MoneyText } from '@/components/shared/money';
import { Screen } from '@/components/shared/screen';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared/state-views';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import { FadeInView } from '@/components/ui/motion';
import { Text } from '@/components/ui/text';
import {
  buildMonthGrid,
  chargesForMonth,
  cursorFor,
  monthTitle,
  shiftMonth,
  totalsForDay,
  type DayCharge,
} from '@/features/calendar/utils';
import { refreshSubscriptions, useDataStore } from '@/features/subscriptions/store';
import { formatDisplayDate, todayISO } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useRouter } from 'expo-router';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarScreen() {
  const router = useRouter();
  const { subscriptions, status, error } = useDataStore();
  const [cursor, setCursor] = React.useState(() => cursorFor(new Date()));
  const [selectedIso, setSelectedIso] = React.useState<string>(() => todayISO());

  const liveSubs = React.useMemo(
    () => subscriptions.filter((s) => !s.archivedAt),
    [subscriptions],
  );

  const cells = React.useMemo(
    () => buildMonthGrid(cursor.year, cursor.monthIndex, 1),
    [cursor.year, cursor.monthIndex],
  );

  const monthChargeMap = React.useMemo(
    () => chargesForMonth(liveSubs, cursor),
    [liveSubs, cursor],
  );

  const allMonthCharges = React.useMemo(() => {
    const list: { date: string; charge: DayCharge }[] = [];
    for (const [date, charges] of monthChargeMap.entries()) {
      for (const charge of charges) {
        list.push({ date, charge });
      }
    }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [monthChargeMap]);

  const monthTotals = React.useMemo(
    () => totalsForDay(allMonthCharges.map((item) => item.charge)),
    [allMonthCharges],
  );

  const selectedCharges = React.useMemo(
    () => monthChargeMap.get(selectedIso) ?? [],
    [monthChargeMap, selectedIso],
  );

  const goPrevMonth = React.useCallback(() => {
    setCursor((prev) => shiftMonth(prev, -1));
  }, []);

  const goNextMonth = React.useCallback(() => {
    setCursor((prev) => shiftMonth(prev, 1));
  }, []);

  const goToday = React.useCallback(() => {
    setCursor(cursorFor(new Date()));
    setSelectedIso(todayISO());
  }, []);

  if (status === 'loading' || status === 'idle') {
    return (
      <Screen>
        <LoadingSkeleton cards={3} />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen>
        <ErrorState
          message={error ?? 'Unable to load calendar.'}
          onRetry={() => void refreshSubscriptions()}
        />
      </Screen>
    );
  }

  const weeks: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <Screen className="gap-6">
      <FadeInView delay={0} className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="gap-1">
          <Text className="text-2xl font-semibold tracking-tight text-foreground">
            Renewal Calendar
          </Text>
          <Text className="text-sm text-muted-foreground">
            See every billing date across the month before charges hit your card.
          </Text>
        </View>
        <Button size="sm" onPress={() => router.push('/subscription/new')}>
          <Icon as={Plus} size={15} className="text-primary-foreground" />
          <Text>Add subscription</Text>
        </Button>
      </FadeInView>

      {liveSubs.length === 0 ? (
        <FadeInView delay={60}>
          <EmptyState
            icon={CalendarDays}
            title="Your calendar is empty"
            description="Add subscriptions to visualize upcoming billing dates across the month."
            actionLabel="Add subscription"
            onAction={() => router.push('/subscription/new')}
          />
        </FadeInView>
      ) : (
        <FadeInView delay={60} className="gap-4 lg:flex-row lg:items-start">
          {/* Calendar Grid Card */}
          <Card className="flex-1 py-5">
            <CardHeader className="px-5">
              <CardTitle className="text-base">{monthTitle(cursor)}</CardTitle>
              <CardDescription>
                {allMonthCharges.length} scheduled event
                {allMonthCharges.length === 1 ? '' : 's'} · Total{' '}
                <CurrencyTotalsText
                  totals={monthTotals}
                  placeholder="$0.00"
                  className="text-xs font-semibold text-foreground"
                />
              </CardDescription>
              <CardAction className="right-5">
                <ButtonGroup>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onPress={goPrevMonth}
                    accessibilityLabel="Previous month"
                  >
                    <Icon as={ChevronLeft} size={15} className="text-foreground" />
                  </Button>
                  <Button variant="outline" size="sm" onPress={goToday}>
                    <Text>Today</Text>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onPress={goNextMonth}
                    accessibilityLabel="Next month"
                  >
                    <Icon as={ChevronRight} size={15} className="text-foreground" />
                  </Button>
                </ButtonGroup>
              </CardAction>
            </CardHeader>

            <CardContent className="gap-2 px-5">
              <View className="flex-row pb-1">
                {WEEKDAY_LABELS.map((w) => (
                  <View key={w} className="flex-1 items-center">
                    <Text className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {w}
                    </Text>
                  </View>
                ))}
              </View>

              <View className="gap-1.5">
                {weeks.map((week, wIdx) => (
                  <View key={wIdx} className="flex-row gap-1.5">
                    {week.map((cell) => {
                      const isSelected = cell.dateISO === selectedIso;
                      const dayCharges = monthChargeMap.get(cell.dateISO) ?? [];
                      const count = dayCharges.length;
                      const dayNum = parseInt(cell.dateISO.slice(-2), 10);
                      return (
                        <Pressable
                          key={cell.dateISO}
                          onPress={() => setSelectedIso(cell.dateISO)}
                          accessibilityRole="button"
                          accessibilityLabel={`${cell.dateISO}, ${count} renewals`}
                          className={cn(
                            'min-h-[54px] flex-1 items-center justify-between rounded-lg border p-1.5 web:transition-all web:duration-150',
                            !cell.inCurrentMonth && 'opacity-35',
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                              : cell.isToday
                                ? 'border-foreground/40 bg-accent/60'
                                : count > 0
                                  ? 'border-border bg-secondary/50 web:hover:bg-accent'
                                  : 'border-transparent bg-transparent web:hover:bg-accent/40',
                          )}
                        >
                          <Text
                            className={cn(
                              'text-xs font-medium tabular-nums',
                              isSelected
                                ? 'font-semibold text-primary-foreground'
                                : cell.isToday
                                  ? 'font-semibold text-foreground'
                                  : 'text-foreground',
                            )}
                          >
                            {dayNum}
                          </Text>

                          {count > 0 ? (
                            <View className="flex-row items-center gap-0.5">
                              {dayCharges.slice(0, 3).map((ch, idx) => (
                                <View
                                  key={`${ch.subscriptionId}-${idx}`}
                                  className={cn(
                                    'h-1.5 w-1.5 rounded-full',
                                    isSelected ? 'bg-primary-foreground' : 'bg-primary',
                                  )}
                                />
                              ))}
                              {count > 3 ? (
                                <Text
                                  className={cn(
                                    'text-[9px] font-semibold',
                                    isSelected
                                      ? 'text-primary-foreground'
                                      : 'text-muted-foreground',
                                  )}
                                >
                                  +{count - 3}
                                </Text>
                              ) : null}
                            </View>
                          ) : (
                            <View className="h-1.5" />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </CardContent>
          </Card>

          {/* Right Column: Selected Day + Month Schedule */}
          <View className="gap-4 lg:w-[360px]">
            <Card className="py-5">
              <CardHeader className="px-5">
                <CardTitle className="text-base">
                  {formatDisplayDate(selectedIso)}
                </CardTitle>
                <CardDescription>
                  {selectedCharges.length > 0
                    ? `${selectedCharges.length} event${selectedCharges.length === 1 ? '' : 's'} scheduled`
                    : 'No charges scheduled on this date'}
                </CardDescription>
                {selectedCharges.length > 0 ? (
                  <CardAction className="right-5">
                    <Badge variant="default">
                      <Text>{selectedCharges.length}</Text>
                    </Badge>
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent className="px-5">
                {selectedCharges.length > 0 ? (
                  <ItemGroup className="gap-2">
                    {selectedCharges.map((ch) => (
                      <Pressable
                        key={`${ch.subscriptionId}-${ch.type}`}
                        onPress={() => router.push(`/subscription/${ch.subscriptionId}`)}
                      >
                        <Item variant="outline" size="sm" className="bg-card">
                          <ItemContent>
                            <ItemTitle>{ch.name}</ItemTitle>
                            <ItemDescription>
                              {ch.type === 'trial_end' ? 'Trial ends' : 'Renewal charge'}
                            </ItemDescription>
                          </ItemContent>
                          <ItemActions>
                            <MoneyText
                              amountCents={ch.amountCents}
                              currency={ch.currency}
                              className="text-sm font-semibold text-foreground"
                            />
                          </ItemActions>
                        </Item>
                      </Pressable>
                    ))}
                  </ItemGroup>
                ) : (
                  <View className="items-center rounded-lg border border-dashed border-border py-6">
                    <Text className="text-xs text-muted-foreground">
                      Select a highlighted date on the calendar to inspect its renewals.
                    </Text>
                  </View>
                )}
              </CardContent>
            </Card>

            {allMonthCharges.length > 0 ? (
              <Card className="py-5">
                <CardHeader className="px-5">
                  <CardTitle className="text-base">
                    All in {monthTitle(cursor)}
                  </CardTitle>
                  <CardDescription>
                    Chronological list of charges this month.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-5">
                  <ItemGroup className="gap-2">
                    {allMonthCharges.map(({ date, charge }) => (
                      <Pressable
                        key={`${charge.subscriptionId}-${date}-${charge.type}`}
                        onPress={() => router.push(`/subscription/${charge.subscriptionId}`)}
                      >
                        <Item variant="outline" size="sm" className="bg-card">
                          <ItemContent>
                            <ItemTitle>{charge.name}</ItemTitle>
                            <ItemDescription>
                              {formatDisplayDate(date)} ·{' '}
                              {charge.type === 'trial_end' ? 'Trial ends' : 'Renewal'}
                            </ItemDescription>
                          </ItemContent>
                          <ItemActions>
                            <MoneyText
                              amountCents={charge.amountCents}
                              currency={charge.currency}
                              className="text-sm font-semibold text-foreground"
                            />
                          </ItemActions>
                        </Item>
                      </Pressable>
                    ))}
                  </ItemGroup>
                </CardContent>
              </Card>
            ) : null}
          </View>
        </FadeInView>
      )}
    </Screen>
  );
}
