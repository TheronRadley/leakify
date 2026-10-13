import { CategoryIcon } from '@/components/shared/category-icon';
import { MoneyText } from '@/components/shared/money';
import { Screen } from '@/components/shared/screen';
import { ErrorState, LoadingSkeleton } from '@/components/shared/state-views';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import { ButtonGroup } from '@/components/ui/button-group';
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
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item';
import { FadeInView, LivePulseDot } from '@/components/ui/motion';
import { Text } from '@/components/ui/text';
import {
  deleteSubscription,
  setSubscriptionFlags,
  setSubscriptionStatus,
  useDataStore,
  useSubscriptionById,
} from '@/features/subscriptions/store';
import {
  annualEquivalentCents,
  intervalLabel,
  monthlyEquivalentCents,
} from '@/lib/billing';
import { categoryLabel } from '@/lib/constants';
import { daysBetween, formatDisplayDate, todayISO } from '@/lib/dates';
import { checkExternalUrl, externalUrlFailureMessage } from '@/lib/links';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  Calendar,
  CreditCard,
  ExternalLink,
  FileText,
  Flag,
  PauseCircle,
  Pencil,
  PlayCircle,
  Trash2,
} from 'lucide-react-native';
import * as React from 'react';
import { Linking, View } from 'react-native';

export default function SubscriptionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status } = useDataStore();
  const sub = useSubscriptionById(id ?? '');
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const today = todayISO();

  const handleTogglePause = React.useCallback(async () => {
    if (!sub) return;
    setBusy(true);
    setActionError(null);
    try {
      const nextStatus = sub.status === 'paused' ? 'active' : 'paused';
      await setSubscriptionStatus(sub.id, nextStatus);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update status.');
    } finally {
      setBusy(false);
    }
  }, [sub]);

  const handleToggleCancelCandidate = React.useCallback(async () => {
    if (!sub) return;
    setBusy(true);
    setActionError(null);
    try {
      await setSubscriptionFlags(sub.id, {
        isCancelCandidate: !sub.isCancelCandidate,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update flag.');
    } finally {
      setBusy(false);
    }
  }, [sub]);

  const handleDelete = React.useCallback(async () => {
    if (!sub) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteSubscription(sub.id);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/subscriptions');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to delete subscription.');
      setBusy(false);
    }
  }, [sub, router]);

  const handleOpenCancelUrl = React.useCallback(async () => {
    if (!sub?.cancellationUrl) return;
    setActionError(null);
    const check = checkExternalUrl(sub.cancellationUrl);
    if (!check.ok) {
      setActionError(externalUrlFailureMessage(check.reason));
      return;
    }
    try {
      await Linking.openURL(check.url);
    } catch {
      setActionError('Unable to open the cancellation link on this device.');
    }
  }, [sub]);

  if (status === 'loading' || status === 'idle') {
    return (
      <Screen>
        <LoadingSkeleton cards={3} />
      </Screen>
    );
  }

  if (!sub) {
    return (
      <Screen>
        <ErrorState
          title="Subscription not found"
          message="This subscription may have been deleted."
          onRetry={() => router.replace('/(tabs)/subscriptions')}
        />
      </Screen>
    );
  }

  const monthly = monthlyEquivalentCents(sub.amountCents, sub.interval);
  const yearly = annualEquivalentCents(sub.amountCents, sub.interval);
  const days = sub.nextBillingDate ? daysBetween(today, sub.nextBillingDate) : null;

  return (
    <Screen edges={['top', 'bottom']} className="gap-6">
      {/* Breadcrumb + Top Actions */}
      <FadeInView delay={0} className="flex-row flex-wrap items-center justify-between gap-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink onPress={() => router.push('/(tabs)/subscriptions')}>
                <Text className="text-sm text-muted-foreground">Subscriptions</Text>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{sub.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <ButtonGroup>
          <Button
            variant="outline"
            size="sm"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
            accessibilityLabel="Back"
          >
            <Icon as={ArrowLeft} size={14} className="text-foreground" />
            <Text>Back</Text>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onPress={() => router.push(`/subscription/${sub.id}/edit`)}
            accessibilityLabel="Edit subscription"
          >
            <Icon as={Pencil} size={14} className="text-foreground" />
            <Text>Edit</Text>
          </Button>
        </ButtonGroup>
      </FadeInView>

      {actionError ? (
        <Alert variant="destructive">
          <AlertTitle>Action could not be completed</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {/* Hero Summary Card */}
      <FadeInView delay={60}>
        <Card className="py-5">
          <CardHeader className="px-5">
            <View className="flex-row items-center gap-3">
              <CategoryIcon category={sub.category} size={44} />
              <View className="flex-1 gap-1">
                <CardTitle className="text-xl">{sub.name}</CardTitle>
                <CardDescription>
                  {categoryLabel(sub.category)}
                  {sub.provider ? ` · ${sub.provider}` : ''}
                </CardDescription>
              </View>
            </View>
            <CardAction className="right-5">
              <Badge
                variant={
                  sub.status === 'active'
                    ? 'success'
                    : sub.status === 'trialing'
                      ? 'warning'
                      : 'secondary'
                }
                className="gap-1.5"
              >
                {sub.status === 'active' || sub.status === 'trialing' ? (
                  <LivePulseDot
                    tone={sub.status === 'active' ? 'success' : 'warning'}
                    size={5}
                  />
                ) : null}
                <Text>{sub.status}</Text>
              </Badge>
            </CardAction>
          </CardHeader>

          <CardContent className="gap-4 px-5">
            <View className="flex-row items-baseline gap-2">
              <MoneyText
                amountCents={sub.amountCents}
                currency={sub.currency}
                className="text-3xl font-semibold tracking-tight text-foreground"
              />
              <Text className="text-sm text-muted-foreground">
                / {intervalLabel(sub.interval).toLowerCase()}
              </Text>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1 rounded-lg border border-border bg-muted/40 p-3">
                <Text className="text-xs text-muted-foreground">Normalized monthly</Text>
                <MoneyText
                  amountCents={monthly}
                  currency={sub.currency}
                  className="mt-1 text-base font-semibold text-foreground"
                />
              </View>
              <View className="flex-1 rounded-lg border border-border bg-muted/40 p-3">
                <Text className="text-xs text-muted-foreground">Normalized yearly</Text>
                <MoneyText
                  amountCents={yearly}
                  currency={sub.currency}
                  className="mt-1 text-base font-semibold text-foreground"
                />
              </View>
            </View>
          </CardContent>

          <CardFooter className="flex-wrap gap-2 border-t border-border px-5 pt-4">
            <Button
              variant="outline"
              size="sm"
              loading={busy}
              onPress={() => void handleTogglePause()}
            >
              <Icon
                as={sub.status === 'paused' ? PlayCircle : PauseCircle}
                size={15}
                className="text-foreground"
              />
              <Text>
                {sub.status === 'paused' ? 'Resume subscription' : 'Pause subscription'}
              </Text>
            </Button>

            <Button
              variant={sub.isCancelCandidate ? 'secondary' : 'outline'}
              size="sm"
              loading={busy}
              onPress={() => void handleToggleCancelCandidate()}
            >
              <Icon as={Flag} size={14} className="text-foreground" />
              <Text>
                {sub.isCancelCandidate ? 'Cancel candidate ✓' : 'Mark cancel candidate'}
              </Text>
            </Button>

            {sub.cancellationUrl ? (
              <Button variant="secondary" size="sm" onPress={() => void handleOpenCancelUrl()}>
                <Icon as={ExternalLink} size={14} className="text-secondary-foreground" />
                <Text>Open cancellation page</Text>
              </Button>
            ) : null}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={busy}>
                  <Icon as={Trash2} size={14} className="text-white" />
                  <Text>Delete</Text>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {sub.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes {sub.name} from your subscriptions and cancels any scheduled
                    renewal reminders.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    <Text>Cancel</Text>
                  </AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onPress={() => void handleDelete()}
                  >
                    <Text>Delete subscription</Text>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      </FadeInView>

      {/* Billing & Schedule Metadata Card */}
      <FadeInView delay={120}>
        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Billing & Schedule</CardTitle>
            <CardDescription>
              Renewal dates, payment method, and reminder settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <ItemGroup className="rounded-lg border border-border">
              <Item size="sm">
                <ItemMedia variant="icon">
                  <Icon as={Calendar} size={15} className="text-muted-foreground" />
                </ItemMedia>
                <ItemContent>
                  <ItemDescription>Next renewal date</ItemDescription>
                  <ItemTitle>
                    {formatDisplayDate(sub.nextBillingDate)}
                    {sub.status !== 'canceled' && days !== null
                      ? days === 0
                        ? ' (today)'
                        : days > 0
                          ? ` (in ${days} day${days === 1 ? '' : 's'})`
                          : ''
                      : ''}
                  </ItemTitle>
                </ItemContent>
              </Item>

              <ItemSeparator />

              <Item size="sm">
                <ItemMedia variant="icon">
                  <Icon as={Bell} size={15} className="text-muted-foreground" />
                </ItemMedia>
                <ItemContent>
                  <ItemDescription>Renewal reminder</ItemDescription>
                  <ItemTitle>
                    {sub.reminders.enabled && sub.reminders.renewalLeadDays.length > 0
                      ? `${sub.reminders.renewalLeadDays.join(', ')} day(s) before billing`
                      : 'Disabled'}
                  </ItemTitle>
                </ItemContent>
              </Item>

              {sub.paymentMethodLabel ? (
                <>
                  <ItemSeparator />
                  <Item size="sm">
                    <ItemMedia variant="icon">
                      <Icon as={CreditCard} size={15} className="text-muted-foreground" />
                    </ItemMedia>
                    <ItemContent>
                      <ItemDescription>Payment method</ItemDescription>
                      <ItemTitle>{sub.paymentMethodLabel}</ItemTitle>
                    </ItemContent>
                  </Item>
                </>
              ) : null}

              {sub.notes ? (
                <>
                  <ItemSeparator />
                  <Item size="sm">
                    <ItemMedia variant="icon">
                      <Icon as={FileText} size={15} className="text-muted-foreground" />
                    </ItemMedia>
                    <ItemContent>
                      <ItemDescription>Notes</ItemDescription>
                      <ItemTitle>{sub.notes}</ItemTitle>
                    </ItemContent>
                  </Item>
                </>
              ) : null}
            </ItemGroup>
          </CardContent>
        </Card>
      </FadeInView>
    </Screen>
  );
}
