import { CategoryIcon } from '@/components/shared/category-icon';
import { MoneyText } from '@/components/shared/money';
import { Screen } from '@/components/shared/screen';
import { EmptyState } from '@/components/shared/state-views';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { FadeInView, ScaleOnPress } from '@/components/ui/motion';
import { Text } from '@/components/ui/text';
import { computesReminderList } from '@/features/notifications/reminders-list';
import { getPermissionStatus } from '@/features/notifications/service';
import { useSubscriptions } from '@/features/subscriptions/store';
import { todayISO } from '@/lib/dates';
import { useRouter } from 'expo-router';
import { BellOff, BellRing } from 'lucide-react-native';
import * as React from 'react';
import { Linking, View } from 'react-native';

export default function RemindersScreen() {
  const router = useRouter();
  const { subscriptions } = useSubscriptions();
  const today = todayISO();
  const [permission, setPermission] = React.useState<'granted' | 'denied' | 'undetermined'>(
    'undetermined',
  );

  React.useEffect(() => {
    void getPermissionStatus().then(setPermission);
  }, []);

  const items = React.useMemo(
    () => computesReminderList(subscriptions, today),
    [subscriptions, today],
  );
  const anyRemindersOff = React.useMemo(
    () =>
      subscriptions.some(
        (s) =>
          !s.archivedAt &&
          (s.status === 'active' || s.status === 'trialing') &&
          !s.reminders.enabled,
      ),
    [subscriptions],
  );

  return (
    <Screen edges={['top', 'bottom']} className="gap-5">
      <FadeInView delay={0}>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink onPress={() => router.push('/(tabs)')}>
                <Text className="text-xs text-muted-foreground">Home</Text>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-xs font-medium">Upcoming reminders</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </FadeInView>

      <FadeInView delay={60} className="gap-5">
        {permission !== 'granted' ? (
          <Alert icon={BellOff} className="border-warning/40 bg-warning/10">
            <AlertTitle>Notifications are off</AlertTitle>
            <AlertDescription>
              {permission === 'denied'
                ? 'Permission is blocked at the system level. Reminders below will not be delivered until you enable notifications for Leakify in your device settings.'
                : 'You have not granted notification permission yet. The schedule below is what would be delivered once you do.'}
            </AlertDescription>
            <View className="mt-3 flex-row">
              <Button
                variant="outline"
                size="sm"
                onPress={() => void Linking.openSettings()}
                accessibilityLabel="Open system settings"
              >
                <Text>Open system settings</Text>
              </Button>
            </View>
          </Alert>
        ) : null}

        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Upcoming reminders</CardTitle>
            <CardDescription>
              Charges and trial deadlines Leakify is watching, with the exact notification each one
              will trigger.
            </CardDescription>
            <CardAction>
              <Badge variant="secondary">
                <Text>{items.length}</Text>
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
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
              <ItemGroup className="gap-2">
                {items.map((item) => {
                  const sub = subscriptions.find((s) => s.id === item.subscriptionId);
                  return (
                    <ScaleOnPress
                      key={`${item.subscriptionId}-${item.occurrenceDate}-${item.type}-${item.leadDays}`}
                      scaleTo={0.99}
                      onPress={() => router.push(`/subscription/${item.subscriptionId}`)}
                      accessibilityRole="button"
                      accessibilityLabel={item.title}
                    >
                      <Item
                        variant="outline"
                        size="sm"
                        className="rounded-lg bg-card web:hover:bg-accent/40 active:bg-accent/50"
                      >
                        <ItemMedia>
                          <CategoryIcon category={sub?.category ?? 'other'} size={36} />
                        </ItemMedia>
                        <ItemContent className="min-w-0 flex-1">
                          <ItemTitle className="font-medium" numberOfLines={2}>
                            {item.title}
                          </ItemTitle>
                          <ItemDescription className="text-xs">
                            Fires {item.fireLabel} ·{' '}
                            {item.type === 'trial' ? 'trial deadline' : 'renewal'}
                          </ItemDescription>
                        </ItemContent>
                        {item.amountCents !== null && item.currency ? (
                          <ItemActions>
                            <MoneyText
                              amountCents={item.amountCents}
                              currency={item.currency}
                              variant="small"
                            />
                          </ItemActions>
                        ) : null}
                      </Item>
                    </ScaleOnPress>
                  );
                })}
              </ItemGroup>
            )}
          </CardContent>
        </Card>

        <Text variant="small" className="px-1 text-xs leading-4 text-muted-foreground">
          Times are in your device timezone and re-sync automatically whenever your subscriptions
          change.
        </Text>
      </FadeInView>
    </Screen>
  );
}
