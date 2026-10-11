import { CategoryIcon } from '@/components/shared/category-icon';
import { MoneyText } from '@/components/shared/money';
import { Screen } from '@/components/shared/screen';
import { ErrorState } from '@/components/shared/state-views';
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
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import {
  deleteSubscription,
  listBillingEvents,
  recordPayment,
  setSubscriptionFlags,
  setSubscriptionStatus,
  updateSubscription,
  useSubscriptionById,
} from '@/features/subscriptions/store';
import {
  annualEquivalentCents,
  intervalLabel,
  latestPriceChange,
  monthlyEquivalentCents,
} from '@/lib/billing';
import { categoryLabel } from '@/lib/constants';
import { formatMoney } from '@/lib/currency';
import { formatDisplayDate, isValidISODate, relativeDayLabel, todayISO } from '@/lib/dates';
import { validateCancellationUrl } from '@/lib/url';
import type { BillingEvent } from '@/types';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Archive,
  Ban,
  BellRing,
  CheckCircle2,
  ExternalLink,
  EyeOff,
  FileText,
  Pause,
  Pencil,
  PiggyBank,
  Play,
  Receipt,
  Trash2,
} from 'lucide-react-native';
import * as Linking from 'expo-linking';
import * as React from 'react';
import { View } from 'react-native';

const STATUS_LABEL = { active: 'Active', trialing: 'Free trial', paused: 'Paused', canceled: 'Canceled' } as const;

export default function SubscriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const sub = useSubscriptionById(id);
  const today = todayISO();
  const [events, setEvents] = React.useState<BillingEvent[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [cancelNotes, setCancelNotes] = React.useState('');

  React.useEffect(() => {
    let mounted = true;
    if (id) {
      listBillingEvents(id)
        .then((list) => mounted && setEvents(list))
        .catch(() => mounted && setEvents([]));
    }
    return () => {
      mounted = false;
    };
  }, [id, sub]);

  const run = React.useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * Open the stored cancellation link — but only after re-validating it here.
   * What is in storage may predate the URL policy (older build, future import),
   * and an unvalidated string must never reach the platform opener. Failures are
   * reported without echoing the link back.
   */
  const openCancellationLink = () => {
    const result = validateCancellationUrl(sub?.cancellationUrl);
    if (!result.ok) {
      setActionError(
        'This cancellation link is not a secure https:// address, so Leakify will not open it. ' +
          'Edit the subscription to update the link.',
      );
      return;
    }
    setActionError(null);
    void Linking.openURL(result.href).catch(() => {
      setActionError('Leakify could not open that link on this device.');
    });
  };

  if (!sub) {
    return (
      <ErrorState
        title="Subscription not found"
        message="It may have been deleted."
        onRetry={() => router.back()}
        retryLabel="Go back"
      />
    );
  }

  const monthly = monthlyEquivalentCents(sub.amountCents, sub.interval);
  const annual = annualEquivalentCents(sub.amountCents, sub.interval);
  const priceChange = latestPriceChange(sub);
  const isLive = !sub.archivedAt && (sub.status === 'active' || sub.status === 'trialing');

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: sub.name }} />

      {/* Header */}
      <View className="flex-row items-center gap-4 pt-4">
        <CategoryIcon category={sub.category} size={56} />
        <View className="flex-1">
          <Text variant="h4" numberOfLines={1}>
            {sub.name}
          </Text>
          <Text variant="muted">
            {sub.provider ?? categoryLabel(sub.category)}
          </Text>
        </View>
        <Badge
          variant={sub.status === 'active' ? 'success' : sub.status === 'trialing' ? 'warning' : sub.status === 'paused' ? 'secondary' : 'outline'}
          label={STATUS_LABEL[sub.status]}
        />
      </View>

      {/* Key figures */}
      <Card className="mt-5 gap-3 p-5">
        <View className="flex-row items-baseline justify-between">
          <MoneyText amountCents={sub.amountCents} currency={sub.currency} variant="h2" />
          <Text variant="muted">{intervalLabel(sub.interval)}</Text>
        </View>
        <Separator />
        <View className="flex-row justify-between">
          <View>
            <Text variant="small" className="text-muted-foreground">
              ≈ monthly equivalent
            </Text>
            <MoneyText amountCents={monthly} currency={sub.currency} variant="large" className="text-lg" />
          </View>
          <View className="items-end">
            <Text variant="small" className="text-muted-foreground">
              ≈ 12 × monthly
            </Text>
            <MoneyText amountCents={annual} currency={sub.currency} variant="large" className="text-lg" />
          </View>
        </View>
        {priceChange ? (
          <View className="flex-row items-center gap-2 rounded-md bg-warning/15 p-2.5">
            <Icon as={Receipt} size={16} className="text-warning" />
            <Text variant="small" className="flex-1 text-foreground">
              Price changed from {formatMoney(priceChange.fromCents, sub.currency)} to{' '}
              {formatMoney(priceChange.toCents, sub.currency)}
            </Text>
          </View>
        ) : null}
      </Card>

      {/* Schedule card */}
      <Card className="mt-3 gap-2 p-5">
        <DetailRow
          label="Next expected payment"
          value={
            sub.nextBillingDate && isValidISODate(sub.nextBillingDate)
              ? `${formatDisplayDate(sub.nextBillingDate)}${
                  relativeDayLabel(sub.nextBillingDate, today) ? ` · ${relativeDayLabel(sub.nextBillingDate, today)}` : ''
                }`
              : 'Not set'
          }
        />
        {sub.trialEndDate ? (
          <DetailRow
            label="Free trial ends"
            value={`${formatDisplayDate(sub.trialEndDate)}${
              relativeDayLabel(sub.trialEndDate, today) ? ` · ${relativeDayLabel(sub.trialEndDate, today)}` : ''
            }`}
          />
        ) : null}
        {sub.startDate ? <DetailRow label="Started" value={formatDisplayDate(sub.startDate)} /> : null}
        {sub.paymentMethodLabel ? <DetailRow label="Payment method" value={sub.paymentMethodLabel} /> : null}
        {sub.canceledAt ? (
          <DetailRow
            label="Marked canceled"
            value={`${formatDisplayDate(sub.canceledAt.slice(0, 10))} (recorded by you — not provider-verified)`}
          />
        ) : null}
        <DetailRow
          label="Reminders"
          value={
            sub.reminders.enabled && isLive
              ? sub.reminders.renewalLeadDays
                  .slice()
                  .sort((a, b) => b - a)
                  .map((d) => (d === 0 ? 'same day' : `${d}d before`))
                  .join(', ')
              : 'Off'
          }
        />
      </Card>

      {sub.notes ? (
        <Card className="mt-3 gap-1.5 p-5">
          <View className="flex-row items-center gap-2">
            <Icon as={FileText} size={16} className="text-muted-foreground" />
            <Text className="font-semibold">Notes</Text>
          </View>
          <Text variant="muted" className="leading-5">
            {sub.notes}
          </Text>
        </Card>
      ) : null}

      {/* Billing history */}
      <Text variant="large" className="pb-2 pt-6">
        Billing history
      </Text>
      {events === null ? (
        <Card className="p-5">
          <Text variant="muted">Loading history…</Text>
        </Card>
      ) : events.length === 0 ? (
        <Card className="gap-1 p-5">
          <Text className="font-semibold">No recorded payments yet</Text>
          <Text variant="muted">
            Use “Record payment” when a charge goes through — Leakify builds your history from
            real events only.
          </Text>
        </Card>
      ) : (
        <Card>
          {events.map((event, idx) => (
            <View key={event.id}>
              {idx > 0 ? <Separator /> : null}
              <View className="flex-row items-center justify-between p-4">
                <View>
                  <Text className="font-medium">{formatDisplayDate(event.actualDate ?? event.expectedDate)}</Text>
                  <Text variant="small" className="text-muted-foreground">
                    {event.type === 'trial_end' ? 'Trial conversion' : 'Renewal'} · {event.status}
                  </Text>
                </View>
                <MoneyText amountCents={event.actualAmountCents ?? event.amountCents} currency={event.currency} variant="small" />
              </View>
            </View>
          ))}
        </Card>
      )}

      {/* Insights flags */}
      <Text variant="large" className="pb-2 pt-6">
        Usage flags
      </Text>
      <Card className="gap-1 p-4">
        <FlagRow
          icon={EyeOff}
          title="I don’t use this anymore"
          description="Feeds the leak detector — only you can decide this."
          checked={sub.flaggedUnused}
          onChange={(v) => void run(() => setSubscriptionFlags(sub.id, { flaggedUnused: v }))}
        />
        <Separator className="my-2" />
        <FlagRow
          icon={PiggyBank}
          title="Candidate to cancel"
          description={`Counts toward potential savings (~${formatMoney(monthly, sub.currency)}/mo estimate).`}
          checked={sub.isCancelCandidate}
          onChange={(v) => void run(() => setSubscriptionFlags(sub.id, { isCancelCandidate: v }))}
        />
        <Separator className="my-2" />
        <FlagRow
          icon={BellRing}
          title="Reminders"
          description="Renewal and trial reminders for this subscription."
          checked={sub.reminders.enabled}
          onChange={(v) =>
            void run(() => updateSubscription(sub.id, { reminders: { ...sub.reminders, enabled: v } }))
          }
        />
      </Card>

      {/* Cancellation assistant */}
      <Text variant="large" className="pb-2 pt-6">
        Cancellation assistant
      </Text>
      <Card className="gap-3 p-4">
        {sub.cancellationUrl ? (
          <Button
            variant="outline"
            disabled={busy}
            onPress={openCancellationLink}
            accessibilityLabel={`Open cancellation page for ${sub.name}`}
          >
            <Icon as={ExternalLink} size={16} className="text-foreground" />
            <Text>Open cancellation page</Text>
          </Button>
        ) : (
          <Text variant="small" className="leading-4 text-muted-foreground">
            No cancellation link saved. Add one by editing the subscription — Leakify opens it
            here when you need it. (Opening a provider page never guarantees the cancellation
            completed; confirm it with the provider.)
          </Text>
        )}
        {sub.cancellationNotes ? (
          <View className="gap-1 rounded-md bg-muted p-3">
            <Text variant="small" className="font-semibold">
              Saved instructions
            </Text>
            <Text variant="small" className="leading-4 text-muted-foreground">
              {sub.cancellationNotes}
            </Text>
          </View>
        ) : null}
        {sub.status === 'trialing' && sub.trialEndDate ? (
          <View className="flex-row items-center gap-2 rounded-md bg-warning/15 p-2.5">
            <Icon as={BellRing} size={16} className="text-warning" />
            <Text variant="small" className="flex-1">
              Trial ends {relativeDayLabel(sub.trialEndDate, today) ?? formatDisplayDate(sub.trialEndDate)} — cancel
              before then to avoid the first charge.
            </Text>
          </View>
        ) : null}
        {sub.status !== 'canceled' ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="secondary" accessibilityLabel={`Mark ${sub.name} as canceled`}>
                <Icon as={Ban} size={16} className="text-secondary-foreground" />
                <Text>Mark as canceled</Text>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Mark as canceled?</AlertDialogTitle>
                <AlertDialogDescription>
                  Record that YOU cancelled this subscription. Leakify does not cancel it with
                  the provider — make sure the provider confirmed it. Reminders stop and the
                  record moves to your history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <View className="gap-1.5">
                <Label>Cancellation notes (optional)</Label>
                <Input
                  value={cancelNotes}
                  onChangeText={setCancelNotes}
                  placeholder="e.g. confirmed by email on Oct 10"
                />
              </View>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  <Text>Back</Text>
                </AlertDialogCancel>
                <AlertDialogAction
                  onPress={() =>
                    void run(async () => {
                      if (cancelNotes.trim()) {
                        await updateSubscription(sub.id, { cancellationNotes: cancelNotes.trim() });
                      }
                      await setSubscriptionStatus(sub.id, 'canceled');
                    })
                  }
                >
                  <Text>Mark canceled</Text>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <View className="flex-row items-center gap-2 rounded-md bg-accent p-2.5">
            <Icon as={CheckCircle2} size={16} className="text-accent-foreground" />
            <Text variant="small" className="flex-1 text-accent-foreground">
              Canceled by you{sub.canceledAt ? ` on ${formatDisplayDate(sub.canceledAt.slice(0, 10))}` : ''}. Not yet
              verified with the provider.
            </Text>
          </View>
        )}
      </Card>

      {actionError ? (
        <Text variant="small" className="pt-3 text-destructive" accessibilityRole="alert">
          {actionError}
        </Text>
      ) : null}

      {/* Primary actions */}
      <View className="gap-2 pb-10 pt-6">
        {isLive && sub.nextBillingDate ? (
          <Button
            variant="outline"
            disabled={busy}
            onPress={() =>
              void run(() => recordPayment(sub.id).then(() => listBillingEvents(sub.id).then(setEvents)))
            }
            accessibilityLabel={`Record payment for ${sub.name} and move the billing date forward`}
          >
            <Icon as={Receipt} size={16} className="text-foreground" />
            <Text>Record payment (rolls billing date forward)</Text>
          </Button>
        ) : null}
        <Button onPress={() => router.push(`/subscription/${sub.id}/edit`)} disabled={busy} accessibilityLabel="Edit subscription">
          <Icon as={Pencil} size={16} className="text-primary-foreground" />
          <Text>Edit</Text>
        </Button>
        <View className="flex-row gap-2">
          {sub.status === 'active' ? (
            <Button
              variant="secondary"
              className="flex-1"
              disabled={busy}
              onPress={() => void run(() => setSubscriptionStatus(sub.id, 'paused'))}
              accessibilityLabel="Pause subscription"
            >
              <Icon as={Pause} size={16} className="text-secondary-foreground" />
              <Text>Pause</Text>
            </Button>
          ) : null}
          {sub.status === 'paused' ? (
            <Button
              variant="secondary"
              className="flex-1"
              disabled={busy}
              onPress={() => void run(() => setSubscriptionStatus(sub.id, 'active'))}
              accessibilityLabel="Resume subscription"
            >
              <Icon as={Play} size={16} className="text-secondary-foreground" />
              <Text>Resume</Text>
            </Button>
          ) : null}
          {sub.status === 'canceled' ? (
            <Button
              variant="secondary"
              className="flex-1"
              disabled={busy}
              onPress={() => void run(() => setSubscriptionStatus(sub.id, 'active'))}
              accessibilityLabel="Reactivate subscription"
            >
              <Icon as={Play} size={16} className="text-secondary-foreground" />
              <Text>Reactivate</Text>
            </Button>
          ) : null}
          {!sub.archivedAt ? (
            <Button
              variant="secondary"
              className="flex-1"
              disabled={busy}
              onPress={() => void run(() => updateSubscription(sub.id, { archivedAt: new Date().toISOString() }))}
              accessibilityLabel="Archive subscription"
            >
              <Icon as={Archive} size={16} className="text-secondary-foreground" />
              <Text>Archive</Text>
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="flex-1"
              disabled={busy}
              onPress={() => void run(() => updateSubscription(sub.id, { archivedAt: null }))}
              accessibilityLabel="Unarchive subscription"
            >
              <Icon as={Archive} size={16} className="text-secondary-foreground" />
              <Text>Unarchive</Text>
            </Button>
          )}
        </View>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" accessibilityLabel={`Delete ${sub.name} permanently`}>
              <Icon as={Trash2} size={16} className="text-destructive-foreground" />
              <Text>Delete</Text>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {sub.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Removes the subscription and its scheduled reminders. Prefer “Mark as canceled”
                if you want to keep the history. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                <Text>Keep it</Text>
              </AlertDialogCancel>
              <AlertDialogAction
                onPress={() => {
                  void deleteSubscription(sub.id).then(() => router.back());
                }}
              >
                <Text>Delete</Text>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </View>
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text variant="small" className="w-[42%] text-muted-foreground">
        {label}
      </Text>
      <Text variant="small" className="flex-1 text-right font-medium">
        {value}
      </Text>
    </View>
  );
}

function FlagRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: Parameters<typeof Icon>[0]['as'];
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <View className="flex-row items-center gap-3 py-1">
      <Icon as={icon} size={18} className="text-muted-foreground" />
      <View className="flex-1">
        <Text className="font-medium">{title}</Text>
        <Text variant="small" className="leading-4 text-muted-foreground">
          {description}
        </Text>
      </View>
      <Switch checked={checked} onCheckedChange={onChange} accessibilityLabel={title} />
    </View>
  );
}
