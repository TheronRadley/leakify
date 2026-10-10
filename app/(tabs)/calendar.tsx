import { CategoryIcon } from '@/components/shared/category-icon';
import { CurrencyTotalsText, MoneyText } from '@/components/shared/money';
import { Screen } from '@/components/shared/screen';
import { EmptyState, LoadingSkeleton } from '@/components/shared/state-views';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import {
  buildMonthGrid,
  chargesForMonth,
  chargesOnDate,
  cursorFor,
  monthTitle,
  shiftMonth,
  totalsForDay,
} from '@/features/calendar/utils';
import { useSubscriptions } from '@/features/subscriptions/store';
import { cn } from '@/lib/utils';
import { todayISO } from '@/lib/dates';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

const WEEKDAYS_MON_FIRST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarScreen() {
  const router = useRouter();
  const { subscriptions, status } = useSubscriptions();
  const todayStr = todayISO();
  const [cursor, setCursor] = React.useState(() => cursorFor(new Date()));
  const [selectedISO, setSelectedISO] = React.useState(todayStr);

  const grid = React.useMemo(() => buildMonthGrid(cursor.year, cursor.monthIndex, 1), [cursor]);
  const monthCharges = React.useMemo(() => chargesForMonth(subscriptions, cursor), [subscriptions, cursor]);
  const selectedCharges = React.useMemo(
    () => chargesOnDate(subscriptions, selectedISO),
    [subscriptions, selectedISO],
  );
  const selectedTotals = React.useMemo(() => totalsForDay(selectedCharges), [selectedCharges]);

  if (status === 'loading' || status === 'idle') return <LoadingSkeleton />;

  return (
    <Screen edges={['top']}>
      {/* Month navigation */}
      <View className="flex-row items-center justify-between pb-3 pt-4">
        <Text variant="h3">{monthTitle(cursor)}</Text>
        <View className="flex-row gap-1">
          <Button
            variant="outline"
            size="icon"
            onPress={() => setCursor((c) => shiftMonth(c, -1))}
            accessibilityLabel="Previous month"
          >
            <Icon as={ChevronLeft} size={20} className="text-foreground" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onPress={() => setCursor((c) => shiftMonth(c, 1))}
            accessibilityLabel="Next month"
          >
            <Icon as={ChevronRight} size={20} className="text-foreground" />
          </Button>
        </View>
      </View>

      {/* Weekday header */}
      <View className="flex-row pb-1">
        {WEEKDAYS_MON_FIRST.map((d) => (
          <Text key={d} variant="small" className="flex-1 text-center font-semibold text-muted-foreground">
            {d}
          </Text>
        ))}
      </View>

      {/* Month grid */}
      <View className="flex-row flex-wrap">
        {grid.map((cell) => {
          const dayCharges = monthCharges.get(cell.dateISO);
          const hasRenewal = Boolean(dayCharges?.some((c) => c.type === 'renewal'));
          const hasTrial = Boolean(dayCharges?.some((c) => c.type === 'trial_end'));
          const selected = cell.dateISO === selectedISO;
          const dayNum = parseInt(cell.dateISO.slice(8, 10), 10);
          return (
            <Pressable
              key={cell.dateISO}
              onPress={() => setSelectedISO(cell.dateISO)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={
                `${cell.dateISO}${cell.isToday ? ', today' : ''}` +
                (dayCharges
                  ? `, ${dayCharges.length} charge${dayCharges.length === 1 ? '' : 's'}${
                      hasTrial ? ', includes a trial deadline' : ''
                    }`
                  : '')
              }
              className={cn(
                'h-14 w-[14.28%] items-center justify-center gap-1 rounded-md',
                selected && 'bg-primary',
                cell.isToday && !selected && 'border border-primary',
              )}
            >
              <Text
                variant="small"
                className={cn(
                  !cell.inCurrentMonth && 'opacity-40',
                  selected ? 'font-bold text-primary-foreground' : 'text-foreground',
                )}
              >
                {dayNum}
              </Text>
              <View className="h-1.5 flex-row gap-1">
                {hasRenewal ? (
                  <View
                    className={cn('h-1.5 w-1.5 rounded-full', selected ? 'bg-primary-foreground' : 'bg-warning')}
                    accessibilityElementsHidden
                  />
                ) : null}
                {hasTrial ? (
                  <View
                    className={cn('h-1.5 w-1.5 rounded-sm rotate-45', selected ? 'bg-primary-foreground' : 'bg-destructive')}
                    accessibilityElementsHidden
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Legend */}
      <View className="flex-row items-center gap-4 pb-2 pt-2">
        <View className="flex-row items-center gap-1.5">
          <View className="h-1.5 w-1.5 rounded-full bg-warning" />
          <Text variant="small" className="text-muted-foreground">
            Billing date
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="h-1.5 w-1.5 rotate-45 rounded-sm bg-destructive" />
          <Text variant="small" className="text-muted-foreground">
            Trial deadline
          </Text>
        </View>
      </View>

      <Separator className="my-2" />

      {/* Selected day detail */}
      <View className="flex-row items-baseline justify-between pb-2">
        <Text variant="large">Charges on {selectedISO}</Text>
        {selectedTotals.length > 0 ? <CurrencyTotalsText totals={selectedTotals} variant="small" /> : null}
      </View>
      {selectedCharges.length === 0 ? (
        <EmptyState
          title="Nothing scheduled"
          description="No renewals or trial deadlines on this day. Select a highlighted date to see its charges."
          className="py-8"
        />
      ) : (
        <View className="gap-2 pb-6">
          {selectedCharges.map((charge) => (
            <Card key={`${charge.subscriptionId}-${charge.type}`} className="overflow-hidden">
              <Pressable
                className="flex-row items-center gap-3 p-3.5 active:bg-accent/40"
                onPress={() => router.push(`/subscription/${charge.subscriptionId}`)}
                accessibilityRole="button"
                accessibilityLabel={`${charge.name}, ${charge.type === 'trial_end' ? 'trial expires' : 'renews'}`}
              >
                <CategoryIcon category={subscriptions.find((s) => s.id === charge.subscriptionId)?.category ?? 'other'} size={36} />
                <View className="flex-1">
                  <Text className="font-semibold">{charge.name}</Text>
                  <Text variant="small" className="text-muted-foreground">
                    {charge.type === 'trial_end' ? 'Free trial ends — first charge may follow' : 'Scheduled renewal'}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  <MoneyText amountCents={charge.amountCents} currency={charge.currency} variant="small" />
                  <Badge
                    variant={charge.type === 'trial_end' ? 'destructive' : 'warning'}
                    label={charge.type === 'trial_end' ? 'Trial' : 'Renewal'}
                  />
                </View>
              </Pressable>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
