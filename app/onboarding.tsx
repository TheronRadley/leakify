import { LeakifyMark } from '@/components/branding/logo';
import { MoneyText } from '@/components/shared/money';
import { Screen } from '@/components/shared/screen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
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
  ItemTitle,
} from '@/components/ui/item';
import { FadeInView } from '@/components/ui/motion';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth/auth-context';
import { requestPermissions } from '@/features/notifications/service';
import { APP_TAGLINE } from '@/lib/constants';
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

function PagerDots({ index, count }: { index: number; count: number }) {
  return (
    <View className="flex-row items-center justify-center gap-2 py-3" accessibilityElementsHidden>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          className={
            i === index ? 'h-2 w-6 rounded-full bg-primary' : 'h-2 w-2 rounded-full bg-border'
          }
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
  const [notifyChoice, setNotifyChoice] = React.useState<'pending' | 'enabled' | 'skipped'>(
    'pending',
  );
  const scrollRef = React.useRef<ScrollView>(null);

  const goTo = (next: number) => {
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
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
    <Screen scroll={false} padded={false} className="bg-background" edges={['top', 'bottom']}>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="mx-auto w-full max-w-lg grow justify-center px-4 py-6"
      >
        {step === 0 ? (
          <FadeInView key="step-0" className="items-center justify-center gap-4">
            <LeakifyMark size={68} />
            <Badge variant="outline">
              <Text>Subscription Intelligence</Text>
            </Badge>
            <Text variant="h2" className="text-center font-semibold tracking-tight">
              Stop the money leaks.
            </Text>
            <Text variant="lead" className="text-center text-sm leading-6 text-muted-foreground">
              {`${APP_TAGLINE} Track every subscription in one place and get reminded before a renewal or free trial charges you.`}
            </Text>
            <ItemGroup className="w-full gap-2.5 pt-2">
              {[
                {
                  icon: CalendarClock,
                  title: 'Upcoming charge visibility',
                  text: 'See every upcoming charge before it happens',
                },
                {
                  icon: BellRing,
                  title: 'Customizable lead times',
                  text: 'Reminders 7, 3, 1 days before — you choose',
                },
                {
                  icon: ShieldCheck,
                  title: 'Private by design',
                  text: 'Your data stays yours. No bank passwords, ever',
                },
              ].map((row) => (
                <Item
                  key={row.title}
                  variant="outline"
                  size="sm"
                  className="rounded-lg bg-card"
                >
                  <ItemMedia variant="icon">
                    <Icon as={row.icon} size={15} className="text-foreground" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{row.title}</ItemTitle>
                    <ItemDescription className="text-xs">{row.text}</ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          </FadeInView>
        ) : null}

        {step === 1 ? (
          <FadeInView key="step-1" className="justify-center gap-5">
            <Text variant="h3" className="text-center font-semibold tracking-tight">
              Small charges add up fast
            </Text>
            <Card className="items-center gap-2">
              <CardHeader className="items-center pb-0">
                <CardDescription className="text-center">
                  Illustrative monthly total tracked by a typical household
                </CardDescription>
                <CardTitle className="text-3xl font-semibold tabular-nums">
                  <MoneyText
                    amountCents={12741}
                    currency="USD"
                    variant="h1"
                    className="text-foreground"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="items-center">
                <Text variant="muted" className="text-center text-xs">
                  ≈{' '}
                  <MoneyText
                    amountCents={152892}
                    currency="USD"
                    variant="small"
                    className="inline"
                  />{' '}
                  projected per year
                </Text>
              </CardContent>
            </Card>
            <Text className="text-center text-sm leading-6 text-muted-foreground">
              These figures are an example, not your data. When you add your own subscriptions,
              advance reminders give you time to cancel renewals you no longer want — before they
              charge you.
            </Text>
          </FadeInView>
        ) : null}

        {step === 2 ? (
          <FadeInView key="step-2" className="justify-center gap-3.5">
            <Text variant="h3" className="pb-1 text-center font-semibold tracking-tight">
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
              <Text variant="small" className="flex-1 text-xs text-muted-foreground">
                You can switch modes later in Settings.
              </Text>
            </View>
          </FadeInView>
        ) : null}

        {step === 3 ? (
          <FadeInView key="step-3" className="justify-center gap-5">
            <Card className="items-center gap-4">
              <CardHeader className="items-center pb-0">
                <View className="mb-2 h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted">
                  <Icon as={BellRing} size={22} className="text-foreground" />
                </View>
                <CardTitle className="text-center text-lg">
                  Never get surprised by a charge
                </CardTitle>
                <CardDescription className="text-center">
                  Leakify schedules on-device reminders before renewals and trial deadlines — like
                  “Your Netflix renewal is coming up in 3 days”. No servers involved.
                </CardDescription>
              </CardHeader>
              <CardContent className="w-full">
                {notifyChoice === 'pending' ? (
                  <View className="gap-2.5">
                    <Button
                      onPress={async () => {
                        const result = await requestPermissions();
                        setNotifyChoice(result === 'granted' ? 'enabled' : 'skipped');
                      }}
                      accessibilityLabel="Enable notifications"
                      className="w-full"
                    >
                      <Text>Enable reminders</Text>
                    </Button>
                    <Button
                      variant="ghost"
                      onPress={() => setNotifyChoice('skipped')}
                      accessibilityLabel="Skip notifications for now"
                      className="w-full"
                    >
                      <Text className="text-muted-foreground">Not now</Text>
                    </Button>
                  </View>
                ) : (
                  <Text className="text-center text-sm text-muted-foreground">
                    {notifyChoice === 'enabled'
                      ? 'Reminders are on. You can fine-tune lead times in Settings.'
                      : 'No problem — you can enable Notifications anytime from your device Settings.'}
                  </Text>
                )}
              </CardContent>
            </Card>
          </FadeInView>
        ) : null}
      </ScrollView>

      <View className="mx-auto w-full max-w-lg gap-2 border-t border-border/60 bg-background px-4 pt-1 pb-3">
        <PagerDots index={step} count={4} />
        {step < 3 ? (
          <Button
            onPress={() => goTo(step + 1)}
            accessibilityLabel={step === 0 ? 'Get started' : 'Continue'}
            className="w-full"
          >
            <Text>{step === 0 ? 'Get Started' : 'Continue'}</Text>
          </Button>
        ) : notifyChoice !== 'pending' ? (
          <Button
            onPress={() => void finish()}
            accessibilityLabel="Finish onboarding"
            className="w-full"
          >
            <Text>Choose how to start using Leakify</Text>
          </Button>
        ) : null}
        {step === 0 ? (
          <Pressable
            onPress={() => void finish()}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
          >
            <Text variant="muted" className="py-1.5 text-center text-xs">
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
    <Card className="gap-3 py-4">
      <CardHeader className="pb-0">
        <View className="flex-row items-center gap-2.5">
          <View className="h-8 w-8 items-center justify-center rounded-md border border-border bg-muted">
            <Icon as={icon} size={16} className="text-foreground" />
          </View>
          <CardTitle className="flex-1 text-sm">{title}</CardTitle>
        </View>
        <CardDescription className="text-xs leading-5">{description}</CardDescription>
      </CardHeader>
      <CardFooter className="border-t border-border pt-3">
        <Button
          size="sm"
          variant={disabled ? 'secondary' : 'default'}
          loading={loading}
          disabled={disabled}
          onPress={onPress}
          className="w-full"
        >
          <Text>{actionLabel}</Text>
        </Button>
      </CardFooter>
    </Card>
  );
}
