import { CategoryIcon } from '@/components/shared/category-icon';
import { MoneyText } from '@/components/shared/money';
import { Screen } from '@/components/shared/screen';
import { EmptyState } from '@/components/shared/state-views';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { computesReminderList } from '@/features/notifications/reminders-list';
import { getPermissionStatus } from '@/features/notifications/service';
import { useSubscriptions } from '@/features/subscriptions/store';
import { todayISO } from '@/lib/dates';
import { useRouter } from 'expo-router';
import { BellOff, BellRing } from 'lucide-react-native';
import * as React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Button } from '@/components/ui/button';

/**
 * Upcoming reminders inbox: everything Leakify will notify about (or would
 * notify about if permission were granted), derived from saved subscription
 * data. The bell badge surfaces here.
 */
export default function RemindersScreen() {
  const router = useRouter();
  const { subscriptions } = useSubscriptions();
  const today = todayISO();
  const [permission, setPermission] = React.useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  React.useEffect(() => {
    void getPermissionStatus().then(setPermission);
  }, []);

  const items = React.useMemo(() => computesReminderList(subscriptions, today), [subscriptions, today]);
  const anyRemindersOff = React.useMemo(
    () =>
      subscriptions.some(
        (s) => !s.archivedAt && (s.status === 'active' || s.status === 'trialing') && !s.reminders.enabled,
      ),
    [subscriptions],
  );

  return (
    <Screen edges={['bottom']}>
      <View className="gap-1 pb-4 pt-4">
        <Text variant="h3">Upcoming reminders</Text>
        <Text variant="muted" className="leading-5">
          Charges and trial deadlines Leakify is watching, with the exact notification each
          one will trigger.
        </Text>
      </View>

      {permission !== 'granted' ? (
        <Card className="mb-4 gap-2 border-warning/50 bg-warning/10 p-4 dark:bg-warning/15">
          <View className="flex-row items-center gap-2">
            <Icon as={BellOff} size={18} className="text-warning" />
            <Text className="font-semibold">Notifications are off</Text>
          </View>
          <Text variant="small" className="leading-4 text-muted-foreground">
            {permission === 'denied'
              ? 'Permission is blocked at the system level. Reminders below will not be delivered until you enable notifications for Leakify in your device settings.'
              : 'You have not granted notification permission yet. The schedule below is what would be delivered once you do.'}
          </Text>
          <Button
            variant="outline"
            size="sm"
            onPress={() => void Linking.openSettings()}
            accessibilityLabel="Open system settings"
          >
            <Text>Open system settings</Text>
          </Button>
        </Card>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="Nothing scheduled"
          description={
            anyRemindersOff
              ? 'Some subscriptions have reminders switched off. Turn reminders on for the subscriptions you care about.'
              : 'Once your subscriptions have billing dates, renewal and trial reminders show up here.'
          }
          actionLabel="Review subscriptions"
          onAction={() => router.push('/(tabs)/subscriptions')}
        />
      ) : (
        <Card>
          {items.map((item, index) => {
            const sub = subscriptions.find((s) => s.id === item.subscriptionId);
            return (
              <View key={`${item.subscriptionId}-${item.occurrenceDate}-${item.type}-${item.leadDays}`}>
                {index > 0 ? <Separator /> : null}
                <Pressable
                  onPress={() => router.push(`/subscription/${item.subscriptionId}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}`}
                  className="flex-row items-center gap-3 p-4 active:bg-accent/40"
                >
                  <CategoryIcon category={sub?.category ?? 'other'} size={36} />
                  <View className="flex-1 gap-0.5">
                    <Text className="font-medium" numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text variant="small" className="text-muted-foreground">
                      Fires {item.fireLabel} · {item.type === 'trial' ? 'trial deadline' : 'renewal'}
                    </Text>
                  </View>
                  {item.amountCents !== null && item.currency ? (
                    <MoneyText amountCents={item.amountCents} currency={item.currency} variant="small" />
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </Card>
      )}
      <Text variant="small" className="px-1 pt-3 leading-4 text-muted-foreground">
        Times are in your device timezone and re-sync automatically whenever your subscriptions
        change.
      </Text>
    </Screen>
  );
}
