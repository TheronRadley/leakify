import { LeakifyMark } from '@/components/branding/logo';
import { MoneyText } from '@/components/shared/money';
import { Screen } from '@/components/shared/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth/auth-context';
import { requestPermissions } from '@/features/notifications/service';
import { isSupabaseConfigured } from '@/services/supabase';
import { useRouter } from 'expo-router';
import {
  BellRing,
  CalendarClock,
  Database,
  Droplets,
  Keyboard,
  Link2,
  ShieldCheck,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { APP_TAGLINE } from '@/lib/constants';

function PagerDots({ index, count }: { index: number; count: number }) {
  return (
    <View className="flex-row items-center justify-center gap-2 py-4" accessibilityElementsHidden>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          className={i === index ? 'h-2 w-6 rounded-full bg-primary' : 'h-2 w-2 rounded-full bg-border'}
        />
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding, enterDemoMode, enterLocalMode } = useAuth();
  const [step, setStep] = React.useState(0);
  const [busy, setBusy] = React.useState<'demo' | 'local' | null>(null);
  const [notifyChoice, setNotifyChoice] = React.useState<'pending' | 'enabled' | 'skipped'>('pending');
  const scrollRef = React.useRef<ScrollView>(null);

  const goTo = (next: number) => {
    setStep(next);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  };

  const startDemo = async () => {
    setBusy('demo');
    try {
      await enterDemoMode();
      router.replace('/(tabs)');
    } finally {
      setBusy(null);
    }
  };

  const startLocal = async () => {
    setBusy('local');
    try {
      await enterLocalMode();
      router.replace('/(tabs)');
    } finally {
      setBusy(null);
    }
  };

  const finish = async () => {
    await completeOnboarding();
    router.replace('/(auth)/sign-in');
  };

  return (
    <Screen scroll={false} className="bg-background" edges={['top', 'bottom']}>
      <ScrollView ref={scrollRef} className="flex-1" contentContainerClassName="grow" scrollEnabled>
        {step === 0 ? (
          <View className="flex-1 items-center justify-center gap-5 px-8">
            <LeakifyMark size={96} />
            <Text variant="h2" className="text-center">
              Stop the money leaks.
            </Text>
            <Text variant="lead" className="text-center leading-7">
              {`${APP_TAGLINE} Track every subscription in one place and get reminded before a renewal or free trial charges you.`}
            </Text>
            <View className="w-full gap-3 pt-4">
              {[
                { icon: CalendarClock, text: 'See every upcoming charge before it happens' },
                { icon: BellRing, text: 'Reminders 7, 3, 1 days before — you choose' },
                { icon: ShieldCheck, text: 'Your data stays yours. No bank passwords, ever' },
              ].map((row) => (
                <View key={row.text} className="flex-row items-center gap-3">
                  <View className="rounded-full bg-accent p-2">
                    <Icon as={row.icon} size={18} className="text-accent-foreground" />
                  </View>
                  <Text className="flex-1 text-muted-foreground">{row.text}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {step === 1 ? (
          <View className="flex-1 justify-center gap-5 px-8">
            <Text variant="h3" className="text-center">
              Small charges add up fast
            </Text>
            <Card className="items-center gap-1 p-6">
              <Text variant="muted" className="text-center">
                Illustrative monthly total tracked by a typical household
              </Text>
              <MoneyText amountCents={12741} currency="USD" variant="h1" className="text-foreground" />
              <Text variant="muted" className="text-center">
                ≈ <MoneyText amountCents={152892} currency="USD" variant="small" className="inline" /> projected per year
              </Text>
            </Card>
            <Text className="text-center leading-6 text-muted-foreground">
              These figures are an example, not your data. When you add your own subscriptions,
              advance reminders give you time to cancel renewals you no longer want — before
              they charge you.
            </Text>
          </View>
        ) : null}

        {step === 2 ? (
          <View className="flex-1 justify-center gap-4 px-8">
            <Text variant="h3" className="pb-2 text-center">
              How do you want to start?
            </Text>
            <ChoiceCard
              icon={Keyboard}
              title="Add subscriptions manually"
              description="Enter the services you pay for and Leakify starts watching them. No account needed — data stays on this device."
              actionLabel="Start manually"
              loading={busy === 'local'}
              disabled={busy !== null}
              onPress={startLocal}
            />
            <ChoiceCard
              icon={Droplets}
              title="Explore the demo"
              description="Load a clearly labeled demo account with realistic sample subscriptions. Clear it anytime."
              actionLabel="Load demo data"
              loading={busy === 'demo'}
              disabled={busy !== null}
              onPress={startDemo}
            />
            <ChoiceCard
              icon={Link2}
              title="Sign in & sync"
              description={
                isSupabaseConfigured
                  ? 'Create an account to back up and sync your subscriptions across devices.'
                  : 'Cloud accounts are not configured in this build yet (EXPO_PUBLIC_SUPABASE_URL). Everything works fully offline.'
              }
              actionLabel={isSupabaseConfigured ? 'Sign in' : 'Not configured'}
              loading={false}
              disabled={!isSupabaseConfigured || busy !== null}
              onPress={() => void finish()}
            />
            <View className="flex-row items-center gap-2 px-1">
              <Icon as={Database} size={14} className="text-muted-foreground" />
              <Text variant="small" className="flex-1 text-muted-foreground">
                You can switch modes later in Settings.
              </Text>
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View className="flex-1 justify-center gap-5 px-8">
            <View className="items-center gap-3">
              <View className="rounded-full bg-accent p-5">
                <Icon as={BellRing} size={36} className="text-accent-foreground" />
              </View>
              <Text variant="h3" className="text-center">
                Never get surprised by a charge
              </Text>
              <Text className="text-center leading-6 text-muted-foreground">
                Leakify schedules on-device reminders before renewals and trial deadlines —
                like “Your Netflix renewal is coming up in 3 days”. No servers involved.
              </Text>
            </View>
            {notifyChoice === 'pending' ? (
              <View className="gap-3">
                <Button
                  onPress={async () => {
                    const result = await requestPermissions();
                    setNotifyChoice(result === 'granted' ? 'enabled' : 'skipped');
                  }}
                  accessibilityLabel="Enable notifications"
                >
                  <Text>Enable reminders</Text>
                </Button>
                <Button variant="ghost" onPress={() => setNotifyChoice('skipped')} accessibilityLabel="Skip notifications for now">
                  <Text className="text-muted-foreground">Not now</Text>
                </Button>
              </View>
            ) : (
              <View className="items-center gap-2">
                <Text className="text-center text-muted-foreground">
                  {notifyChoice === 'enabled'
                    ? 'Reminders are on. You can fine-tune lead times in Settings.'
                    : 'No problem — you can enable Notifications anytime from your device Settings.'}
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      <PagerDots index={step} count={4} />
      <View className="gap-2 px-8 pb-2">
        {step < 3 ? (
          <Button onPress={() => goTo(step + 1)} accessibilityLabel={step === 0 ? 'Get started' : 'Continue'}>
            <Text>{step === 0 ? 'Get Started' : 'Continue'}</Text>
          </Button>
        ) : notifyChoice !== 'pending' ? (
          <Button onPress={() => void finish()} accessibilityLabel="Finish onboarding">
            <Text>Choose how to start using Leakify</Text>
          </Button>
        ) : null}
        {step === 0 ? (
          <Pressable onPress={() => void finish()} accessibilityRole="button" accessibilityLabel="Skip onboarding">
            <Text variant="muted" className="py-2 text-center">
              Skip
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

function ChoiceCard({
  icon,
  title,
  description,
  actionLabel,
  loading,
  disabled,
  onPress,
}: {
  icon: Parameters<typeof Icon>[0]['as'];
  title: string;
  description: string;
  actionLabel: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Card className="gap-3 p-4">
      <View className="flex-row items-center gap-3">
        <View className="rounded-lg bg-accent p-2">
          <Icon as={icon} size={20} className="text-accent-foreground" />
        </View>
        <Text className="flex-1 font-semibold">{title}</Text>
      </View>
      <Text variant="small" className="leading-5 text-muted-foreground">
        {description}
      </Text>
      <Separator />
      <Button size="sm" variant={disabled ? 'secondary' : 'default'} loading={loading} disabled={disabled} onPress={onPress}>
        <Text>{actionLabel}</Text>
      </Button>
    </Card>
  );
}
