import { Screen } from '@/components/shared/screen';
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
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth/auth-context';
import {
  discardQuarantined,
  getStorageIssues,
  restoreQuarantined,
} from '@/services/local-storage';
import { getPermissionStatus, requestPermissions } from '@/features/notifications/service';
import {
  deleteAllAccountData,
  promoteLocalDataToCloud,
  readModeCounts,
  refreshSubscriptions,
  resetDemoData,
  updateNotificationSettings,
  updateProfile,
  useDataStore,
} from '@/features/subscriptions/store';
import { describeModeTransition, describePromotion } from '@/features/subscriptions/mode-transition';
import { RENEWAL_LEAD_OPTIONS, SUPPORTED_CURRENCIES, TRIAL_LEAD_OPTIONS } from '@/lib/constants';
import { useAppTheme, type ThemePreference } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useRouter } from 'expo-router';
import {
  BellRing,
  ChevronRight,
  CircleDollarSign,
  FlaskConical,
  HelpCircle,
  LogOut,
  Palette,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react-native';
import * as React from 'react';
import { Linking, Pressable, Share, View } from 'react-native';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="pt-6">
      <Text variant="small" className="pb-2 font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </Text>
      <Card>{children}</Card>
    </View>
  );
}

function Row({
  icon,
  title,
  description,
  right,
  onPress,
  destructive,
  accessibilityLabel,
}: {
  icon?: Parameters<typeof Icon>[0]['as'];
  title: string;
  description?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  accessibilityLabel?: string;
}) {
  const content = (
    <View className="flex-row items-center gap-3 p-4">
      {icon ? (
        <Icon as={icon} size={20} className={destructive ? 'text-destructive' : 'text-muted-foreground'} />
      ) : null}
      <View className="flex-1">
        <Text className={cn('font-medium', destructive && 'text-destructive')}>{title}</Text>
        {description ? (
          <Text variant="small" className="leading-4 text-muted-foreground">
            {description}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon as={ChevronRight} size={18} className="text-muted-foreground" /> : null)}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} className="active:bg-accent/50">
      {content}
    </Pressable>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Match system' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { profile, subscriptions, notificationSettings, isDemo, mode } = useDataStore();
  const [modeCounts, setModeCounts] = React.useState<{
    localOnlyCount: number;
    cloudOnlyCount: number;
    promotableCount: number;
  } | null>(null);
  const [promotionNote, setPromotionNote] = React.useState<string | null>(null);
  const [isPromoting, setIsPromoting] = React.useState(false);

  // What the *other* store holds, read from the repositories so the copy below can
  // be trusted. Recomputed when the active list or the sign-in changes.
  const signedInId = auth.user?.id ?? null;
  React.useEffect(() => {
    let cancelled = false;
    void readModeCounts(signedInId).then((counts) => {
      if (!cancelled) setModeCounts(counts);
    });
    return () => {
      cancelled = true;
    };
  }, [signedInId, mode, subscriptions.length]);

  const modeNotice = modeCounts
    ? describeModeTransition({
        mode,
        isSignedIn: Boolean(signedInId),
        localOnlyCount: modeCounts.promotableCount,
        cloudOnlyCount: modeCounts.cloudOnlyCount,
      })
    : null;

  const handlePromote = async () => {
    setIsPromoting(true);
    setPromotionNote(null);
    try {
      setPromotionNote(describePromotion(await promoteLocalDataToCloud()));
      setModeCounts(await readModeCounts(signedInId));
    } finally {
      setIsPromoting(false);
    }
  };
  const { preference, setPreference } = useAppTheme();
  const [permission, setPermission] = React.useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [busy, setBusy] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  React.useEffect(() => {
    void getPermissionStatus().then(setPermission);
  }, []);

  const toggleLead = async (list: number[], days: number, key: 'renewalLeadDays' | 'trialLeadDays') => {
    const next = list.includes(days) ? list.filter((d) => d !== days) : [...list, days].sort((a, b) => b - a);
    await updateNotificationSettings({ [key]: next });
  };

  const exportData = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        app: 'leakify',
        profile,
        subscriptions,
      };
      await Share.share({
        message: JSON.stringify(payload, null, 2),
        title: 'Leakify data export',
      });
    } catch {
      setFeedback('Export failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Account deletion, ordered so nothing is claimed before it happens:
   *   1. cloud: the trusted function deletes the server rows *and* the auth
   *      identity (it throws on a partial failure, which we surface instead of
   *      continuing),
   *   2. local: reminders are cancelled, then the device scope is wiped,
   *   3. sign out.
   * A failure at step 1 leaves the account intact and retryable — that is the
   * whole point of reporting rather than swallowing it.
   */
  const handleDeleteAccount = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      if (auth.user) {
        try {
          await auth.deleteCloudAccount();
        } catch (err) {
          setFeedback(
            err instanceof Error
              ? `${err.message} Nothing was deleted on this device either, so you can retry safely.`
              : 'Cloud account deletion did not complete. Nothing was deleted on this device, so you can retry safely.',
          );
          return;
        }
      }

      const result = await deleteAllAccountData();
      if (!result.dataDeleted) {
        setFeedback(`${result.error ?? 'Local deletion did not finish.'} Try again — your data is still here.`);
        return;
      }
      setFeedback('Your account and data were deleted.');
      router.replace('/(auth)/sign-in');
    } finally {
      setBusy(false);
    }
  };

  const handleResetDemo = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await resetDemoData();
      if (!result.dataDeleted) {
        setFeedback(result.error ?? 'Demo refresh failed. Please try again.');
        return;
      }
      setFeedback(
        result.notificationsFailed > 0
          ? 'Demo data was refreshed. Some reminders had already fired and needed no cancellation.'
          : 'Demo data was refreshed.',
      );
    } finally {
      setBusy(false);
    }
  };

  const switchMode = async () => {
    await auth.signOut();
    router.replace('/onboarding');
  };

  return (
    <Screen edges={['top']}>
      <Text variant="h3" className="pt-4">
        Settings
      </Text>

      {/* Profile & account */}
      <Section title="Profile & account">
        <Row
          icon={ShieldCheck}
          title={profile?.displayName ?? 'Leakify user'}
          description={
            auth.user?.email ??
            (isDemo ? 'Demo mode — sample data only' : 'Local mode — data stays on this device')
          }
        />
        <Separator />
        <ProfileEditor />
        <Separator />
        <View className="flex-row items-center justify-between p-4">
          <View className="flex-row items-center gap-3">
            <Icon as={CircleDollarSign} size={20} className="text-muted-foreground" />
            <View>
              <Text className="font-medium">Preferred currency</Text>
              <Text variant="small" className="text-muted-foreground">
                Display default only — amounts in other currencies are never converted.
              </Text>
            </View>
          </View>
        </View>
        <View className="px-4 pb-4">
          <Select
            value={{
              value: profile?.preferredCurrency ?? 'USD',
              label: profile?.preferredCurrency ?? 'USD',
            }}
            onValueChange={async (option) => {
              if (option?.value) await updateProfile({ preferredCurrency: option.value });
            }}
          >
            <SelectTrigger accessibilityLabel="Preferred currency">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code} label={`${c.code} — ${c.name}`}>
                  {`${c.code} — ${c.name}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </View>
        <Separator />
        <Row
          icon={Palette}
          title="Theme"
          right={
            <View className="w-40">
              <Select
                value={THEME_OPTIONS.find((o) => o.value === preference)!}
                onValueChange={(option) => option && setPreference(option.value as ThemePreference)}
              >
                <SelectTrigger accessibilityLabel="Theme preference">
                  <SelectValue placeholder="Theme" />
                </SelectTrigger>
                <SelectContent>
                  {THEME_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} label={o.label}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </View>
          }
        />
      </Section>

      {/* Notifications */}
      <Section title="Reminders & notifications">
        <Row
          icon={BellRing}
          title="Notification permission"
          description={
            permission === 'granted'
              ? 'Granted — reminders will be delivered.'
              : permission === 'denied'
                ? 'Blocked. Enable notifications for Leakify in your device settings to get reminders.'
                : 'Not requested yet.'
          }
          right={
            permission === 'undetermined' ? (
              <Button
                size="sm"
                variant="outline"
                onPress={async () => {
                  const result = await requestPermissions();
                  setPermission(result);
                }}
                accessibilityLabel="Allow notifications"
              >
                <Text>Allow</Text>
              </Button>
            ) : undefined
          }
          onPress={permission === 'denied' ? () => void Linking.openSettings() : undefined}
        />
        <Separator />
        <View className="gap-2 p-4">
          <Text className="font-medium">Remind me before renewals</Text>
          <View className="gap-2.5 pt-1">
            {RENEWAL_LEAD_OPTIONS.map((days) => (
              <View key={days} className="flex-row items-center gap-3">
                <Checkbox
                  checked={notificationSettings.renewalLeadDays.includes(days)}
                  onCheckedChange={() => void toggleLead(notificationSettings.renewalLeadDays, days, 'renewalLeadDays')}
                  accessibilityLabel={`Renewal reminder ${days === 0 ? 'on billing day' : `${days} days before`}`}
                />
                <Label onPress={() => void toggleLead(notificationSettings.renewalLeadDays, days, 'renewalLeadDays')}>
                  {days === 0 ? 'On the billing day' : `${days} day${days === 1 ? '' : 's'} before`}
                </Label>
              </View>
            ))}
          </View>
        </View>
        <Separator />
        <View className="gap-2 p-4">
          <Text className="font-medium">Free trial deadlines</Text>
          <View className="gap-2.5 pt-1">
            {TRIAL_LEAD_OPTIONS.map((days) => (
              <View key={days} className="flex-row items-center gap-3">
                <Checkbox
                  checked={notificationSettings.trialLeadDays.includes(days)}
                  onCheckedChange={() => void toggleLead(notificationSettings.trialLeadDays, days, 'trialLeadDays')}
                  accessibilityLabel={`Trial reminder ${days === 0 ? 'on expiry day' : `${days} days before`}`}
                />
                <Label onPress={() => void toggleLead(notificationSettings.trialLeadDays, days, 'trialLeadDays')}>
                  {days === 0 ? 'On the day it ends' : `${days} day${days === 1 ? '' : 's'} before it ends`}
                </Label>
              </View>
            ))}
          </View>
        </View>
        <Separator />
        <View className="gap-2 p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="font-medium">Detailed notification previews</Text>
              <Text variant="small" className="text-muted-foreground">
                Off (recommended): reminders say only that a renewal or trial is coming up. On: the
                service name and amount appear on your lock screen, visible to anyone nearby.
              </Text>
            </View>
            <Switch
              checked={notificationSettings.previewMode === 'detailed'}
              onCheckedChange={(checked) =>
                void updateNotificationSettings({ previewMode: checked ? 'detailed' : 'generic' })
              }
              accessibilityLabel="Show service names and amounts in notifications"
            />
          </View>
          <Text variant="small" className="text-muted-foreground">
            Changing this re-schedules your reminders so the preview text matches.
          </Text>
        </View>
        <Separator />
        <View className="flex-row items-center justify-between p-4">
          <View className="flex-1 pr-3">
            <Text className="font-medium">Weekly digest</Text>
            <Text variant="small" className="text-muted-foreground">
              “You have N subscription payments scheduled this week.”
            </Text>
          </View>
          <Switch
            checked={notificationSettings.weeklyDigestEnabled}
            onCheckedChange={(checked) => void updateNotificationSettings({ weeklyDigestEnabled: checked })}
            accessibilityLabel="Weekly digest"
          />
        </View>
      </Section>

      {/* Appearance preview note + demo */}
      {isDemo ? (
        <Section title="Demo mode">
          <Row
            icon={FlaskConical}
            title="Refresh demo data"
            description="Clears demo edits and re-seeds the sample account."
            onPress={() => void handleResetDemo()}
          />
          <Separator />
          <Row
            icon={Trash2}
            title="Leave demo & start fresh"
            description="Switch to your own on-device data."
            onPress={() => void switchMode()}
          />
        </Section>
      ) : null}

      {/* Mode transition: never let the other store become a silent surprise. */}
      {modeNotice ? (
        <Section title="Storage & sync">
          <View className="gap-3 p-4">
            <Text className="font-medium">{modeNotice.title}</Text>
            <Text variant="small" className="text-muted-foreground">
              {modeNotice.body}
            </Text>
            {modeNotice.action === 'upload' ? (
              <Button
                variant="outline"
                loading={isPromoting}
                onPress={() => void handlePromote()}
                accessibilityLabel="Copy the on-device subscriptions into my account"
              >
                <Text>Copy them into my account</Text>
              </Button>
            ) : null}
            {promotionNote ? (
              <Text variant="small" className="text-muted-foreground">
                {promotionNote}
              </Text>
            ) : null}
          </View>
        </Section>
      ) : null}

      {/* Data & privacy */}
      <Section title="Data & privacy">
        <Row
          icon={Upload}
          title="Export my data"
          description={busy ? 'Preparing export…' : 'Share a JSON copy of your profile and subscriptions.'}
          onPress={() => void exportData()}
        />
        <Separator />
        <Row
          icon={ShieldCheck}
          title="Privacy at Leakify"
          description="What is stored where, and why."
          onPress={() => router.push('/privacy')}
        />
        <Separator />
        <Row
          icon={HelpCircle}
          title="Help & feedback"
          description="Report a bug or request a feature."
          onPress={() => {
            void Linking.openURL('mailto:support@leakify.app?subject=Leakify%20feedback').catch(() => {
              setFeedback('Could not open your email app. Write to support@leakify.app instead.');
            });
          }}
        />
      </Section>

      {/* Danger zone */}
      <Section title="Account">
        {auth.user ? (
          <>
            <Row
              icon={LogOut}
              title="Sign out"
              description="Your synced data stays on the server."
              onPress={() => {
                void auth.signOut().then(() => router.replace('/(auth)/sign-in'));
              }}
            />
            <Separator />
          </>
        ) : (
          <>
            <Row
              icon={LogOut}
              title={isDemo ? 'Exit demo' : 'Switch mode'}
              description="Choose a different way to use Leakify."
              onPress={() => void switchMode()}
            />
            <Separator />
          </>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Pressable accessibilityRole="button" accessibilityLabel="Delete all my data" className="active:bg-destructive/10">
              <View className="flex-row items-center gap-3 p-4">
                <Icon as={Trash2} size={20} className="text-destructive" />
                <View className="flex-1">
                  <Text className="font-medium text-destructive">
                    {auth.user ? 'Delete my account and all my data' : 'Delete all my data on this device'}
                  </Text>
                  <Text variant="small" className="text-muted-foreground">
                    {auth.user
                      ? 'Removes your Leakify sign-in, your server rows (subscriptions, billing history, preferences) and this device copy. Permanent.'
                      : 'Removes subscriptions, billing history, settings and profile from this device only — there is no account or server copy. Permanent.'}
                  </Text>
                </View>
              </View>
            </Pressable>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete all data?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes your subscriptions, billing history, preferences and
                profile{auth.user ? ', and deletes the Leakify account itself' : ' from this device'}.
                Scheduled reminders are cancelled first. This cannot be undone — export a copy
                first if you want one.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                <Text>Keep my data</Text>
              </AlertDialogCancel>
              <AlertDialogAction onPress={() => void handleDeleteAccount()}>
                <Text>Delete everything</Text>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Section>

      {/* Storage diagnostics: a corrupt or newer-versioned payload must be
          visible, never presented as "you have nothing". */}
      <StorageDiagnostics />

      {feedback ? (
        <Text variant="small" className="pt-3 text-center text-primary" accessibilityLiveRegion="polite">
          {feedback}
        </Text>
      ) : null}

      <Text variant="small" className="pb-10 pt-8 text-center text-muted-foreground">
        Leakify 1.0.0 — privacy-first subscription tracking.
      </Text>
      <View className="h-6" />
    </Screen>
  );
}

/**
 * Surfaces local-storage read failures and offers the two honest actions:
 * retry the recovery copy, or throw it away. Never shows stored values.
 */
function StorageDiagnostics() {
  // Read at render time: the registry is in-memory and this screen re-renders
  // after every action, so no effect (and no state-sync dance) is needed.
  const issues = getStorageIssues();
  const [note, setNote] = React.useState<string | null>(null);

  if (issues.length === 0) return null;

  const act = async (key: string, action: 'restore' | 'discard') => {
    if (action === 'discard') {
      await discardQuarantined(key);
      setNote('The unreadable copy was discarded.');
      return;
    }
    const restored = await restoreQuarantined(key);
    setNote(
      restored
        ? 'Recovered the saved copy and refreshed the list.'
        : 'The saved copy is still not readable by this version of Leakify. Nothing was changed.',
    );
    if (restored) await refreshSubscriptions();
  };

  return (
    <Section title="Storage health">
      <View className="gap-3 p-4">
        <Text variant="small" className="leading-4 text-destructive" accessibilityRole="alert">
          {issues.length === 1
            ? 'One saved record could not be read, so it is not shown in the app. Its contents were preserved for recovery.'
            : `${issues.length} saved records could not be read, so they are not shown in the app. Their contents were preserved for recovery.`}
        </Text>
        {issues.map((issue) => (
          <View key={issue.key} className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text variant="small" className="font-medium">
                {issue.kind}
              </Text>
              <Text variant="small" className="text-muted-foreground">
                {issue.status === 'unsupported_version'
                  ? 'saved by a newer version of Leakify'
                  : 'unreadable or partially saved'}{' '}
                · {issue.bytes} bytes · {issue.at.slice(0, 10)}
              </Text>
            </View>
            <Button size="sm" variant="outline" onPress={() => void act(issue.key, 'restore')}>
              <Text>Recover</Text>
            </Button>
            <Button size="sm" variant="ghost" onPress={() => void act(issue.key, 'discard')}>
              <Text>Discard</Text>
            </Button>
          </View>
        ))}
        {note ? (
          <Text variant="small" className="text-muted-foreground" accessibilityLiveRegion="polite">
            {note}
          </Text>
        ) : null}
      </View>
    </Section>
  );
}

const LOCALE_OPTIONS = ['en-US', 'en-GB', 'de-DE', 'es-ES', 'fr-FR', 'pt-BR', 'it-IT', 'ja-JP'];
const TIMEZONE_OPTIONS = [
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Madrid',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Africa/Algiers',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Australia/Sydney',
];

/** Display name, locale and timezone editing (used by formatting + reminders). */
function ProfileEditor() {
  const { profile } = useDataStore();
  const [name, setName] = React.useState(profile?.displayName ?? '');
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  // Resync the input when the store profile refreshes (render-phase adjust pattern).
  const [prevProfileName, setPrevProfileName] = React.useState(profile?.displayName ?? '');
  const currentProfileName = profile?.displayName ?? '';
  if (prevProfileName !== currentProfileName) {
    setPrevProfileName(currentProfileName);
    setName(currentProfileName);
  }

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ displayName: name.trim() || 'Leakify User' });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="gap-3 p-4">
      <Text className="font-medium">Profile details</Text>
      <View className="flex-row items-center gap-2">
        <Input
          value={name}
          onChangeText={setName}
          placeholder="Display name"
          className="flex-1"
          accessibilityLabel="Display name"
        />
        <Button size="sm" variant="outline" loading={saving} onPress={() => void save()} accessibilityLabel="Save display name">
          <Text>{saved ? 'Saved ✓' : 'Save'}</Text>
        </Button>
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Select
            value={{ value: profile?.locale ?? 'en-US', label: profile?.locale ?? 'en-US' }}
            onValueChange={async (option) => {
              if (option?.value) await updateProfile({ locale: option.value });
            }}
          >
            <SelectTrigger accessibilityLabel="Locale">
              <SelectValue placeholder="Locale" />
            </SelectTrigger>
            <SelectContent>
              {LOCALE_OPTIONS.map((l) => (
                <SelectItem key={l} value={l} label={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </View>
        <View className="flex-[1.6]">
          <Select
            value={{ value: profile?.timezone ?? 'UTC', label: profile?.timezone ?? 'UTC' }}
            onValueChange={async (option) => {
              if (option?.value) await updateProfile({ timezone: option.value });
            }}
          >
            <SelectTrigger accessibilityLabel="Timezone">
              <SelectValue placeholder="Timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_OPTIONS.map((tz) => (
                <SelectItem key={tz} value={tz} label={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </View>
      </View>
      <Text variant="small" className="leading-4 text-muted-foreground">
        Reminder times and date labels follow your device timezone; these preferences tune
        display formatting.
      </Text>
    </View>
  );
}

