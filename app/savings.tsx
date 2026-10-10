import { CategoryIcon } from '@/components/shared/category-icon';
import { CurrencyTotalsText, MoneyText } from '@/components/shared/money';
import { Screen } from '@/components/shared/screen';
import { EmptyState } from '@/components/shared/state-views';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import {
  contributesToRecurringSpend,
  intervalLabel,
  monthlyEquivalentCents,
  potentialSavingsByCurrency,
} from '@/lib/billing';
import { setSubscriptionFlags, useSubscriptions } from '@/features/subscriptions/store';
import { useRouter } from 'expo-router';
import { PiggyBank } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

/**
 * Review potential savings: subscriptions the USER flagged as cancellation
 * candidates. Estimates are recurring-amount math, clearly labeled — never
 * presented as money already saved.
 */
export default function SavingsScreen() {
  const router = useRouter();
  const { subscriptions } = useSubscriptions();
  const candidates = React.useMemo(
    () => subscriptions.filter((s) => s.isCancelCandidate && s.status !== 'canceled' && !s.archivedAt),
    [subscriptions],
  );
  const totals = React.useMemo(() => potentialSavingsByCurrency(subscriptions), [subscriptions]);
  const liveCount = React.useMemo(() => subscriptions.filter(contributesToRecurringSpend).length, [subscriptions]);

  return (
    <Screen edges={['bottom']}>
      <View className="gap-1 pb-4 pt-4">
        <Text variant="h3">Potential savings</Text>
        <Text variant="muted" className="leading-5">
          What you could save per month by cancelling these subscriptions — an estimate from
          the amounts you recorded. It only becomes money saved once a cancellation is confirmed.
        </Text>
      </View>

      {totals.length > 0 ? (
        <Card className="mb-4 items-center gap-1 border-primary/40 bg-accent p-5">
          <Text variant="small" className="text-muted-foreground">
            Estimated per month
          </Text>
          <CurrencyTotalsText totals={totals} variant="h2" className="text-primary" />
          <Text variant="small" className="text-muted-foreground">
            ≈ {new Date().getFullYear()} impact, projected
          </Text>
        </Card>
      ) : null}

      {candidates.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title={liveCount === 0 ? 'Nothing to review yet' : 'No cancellation candidates'}
          description={
            liveCount === 0
              ? 'Add subscriptions first, then flag the ones you might drop.'
              : 'Open a subscription and switch on “Candidate to cancel”. Flagged items appear here with their estimated savings.'
          }
          actionLabel={liveCount === 0 ? 'Add a subscription' : 'Browse subscriptions'}
          onAction={() => router.push(liveCount === 0 ? '/subscription/new' : '/(tabs)/subscriptions')}
        />
      ) : (
        <View className="gap-2 pb-8">
          {candidates.map((sub) => {
            const monthly = monthlyEquivalentCents(sub.amountCents, sub.interval);
            return (
              <Card key={sub.id} className="gap-3 p-4">
                <View className="flex-row items-center gap-3">
                  <CategoryIcon category={sub.category} size={38} />
                  <View className="flex-1">
                    <Text className="font-semibold" numberOfLines={1}>
                      {sub.name}
                    </Text>
                    <Text variant="small" className="text-muted-foreground">
                      {intervalLabel(sub.interval)} · saves{' '}
                      <MoneyText amountCents={monthly} currency={sub.currency} variant="small" className="inline" />
                      /mo
                    </Text>
                  </View>
                  <MoneyText amountCents={sub.amountCents} currency={sub.currency} variant="small" />
                </View>
                <Separator />
                <View className="flex-row gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onPress={() => router.push(`/subscription/${sub.id}`)}
                    accessibilityLabel={`Open ${sub.name} to cancel`}
                  >
                    <Text>Cancel it</Text>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => void setSubscriptionFlags(sub.id, { isCancelCandidate: false })}
                    accessibilityLabel={`Keep ${sub.name}`}
                  >
                    <Text>Keep it</Text>
                  </Button>
                </View>
              </Card>
            );
          })}
          <Text variant="small" className="px-1 pt-2 leading-4 text-muted-foreground">
            “Cancel it” opens the cancellation assistant with your saved provider link and
            instructions. Cancelling happens with the provider — confirm it there, then mark it
            canceled here.
          </Text>
        </View>
      )}
    </Screen>
  );
}
