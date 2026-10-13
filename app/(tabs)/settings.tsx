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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item';
import { FadeInView } from '@/components/ui/motion';
import { Text } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuth } from '@/features/auth/auth-context';
import {
  deleteAllAccountData,
  resetDemoData,
  useDataStore,
} from '@/features/subscriptions/store';
import { useAppTheme } from '@/lib/theme';
import { isSupabaseConfigured } from '@/services/supabase';
import { useRouter } from 'expo-router';
import {
  Bell,
  ChevronRight,
  Database,
  LogIn,
  LogOut,
  Moon,
  PiggyBank,
  Shield,
  Sparkles,
  Sun,
  Trash2,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut, enterDemoMode, dataMode } = useAuth();
  const { subscriptions, profile, isDemo } = useDataStore();
  const { colorScheme, setPreference } = useAppTheme();
  const [busy, setBusy] = React.useState(false);

  const initials = React.useMemo(() => {
    const src = profile?.displayName || user?.email || 'G';
    return src
      .split(/\s+/)
      .map((s) => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [profile?.displayName, user?.email]);

  const handleSeed = React.useCallback(async () => {
    setBusy(true);
    try {
      if (isDemo || dataMode === 'demo') {
        await resetDemoData();
      } else {
        await enterDemoMode();
      }
    } finally {
      setBusy(false);
    }
  }, [dataMode, enterDemoMode, isDemo]);

  const handleClear = React.useCallback(async () => {
    setBusy(true);
    try {
      await deleteAllAccountData();
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <Screen className="gap-6">
      <FadeInView delay={0} className="gap-1">
        <Text className="text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </Text>
        <Text className="text-sm text-muted-foreground">
          Account profile, appearance preferences, reminders, and local data controls.
        </Text>
      </FadeInView>

      {/* Account Card */}
      <FadeInView delay={50}>
        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Account</CardTitle>
            <CardDescription>
              {user
                ? 'Signed in to your Leakify workspace.'
                : 'Using local guest workspace on this device.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <View className="flex-row items-center gap-3">
              <Avatar alt={user?.email ?? 'Guest'} size="lg">
                <AvatarFallback>
                  <Text className="text-sm font-semibold text-foreground">{initials}</Text>
                </AvatarFallback>
              </Avatar>
              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-semibold text-foreground">
                    {user ? profile?.displayName || user.email : 'Guest Workspace'}
                  </Text>
                  <Badge variant={user ? 'success' : 'secondary'}>
                    <Text>
                      {user
                        ? isSupabaseConfigured
                          ? 'Cloud Synced'
                          : 'Local Account'
                        : isDemo
                          ? 'Sample Mode'
                          : 'Offline Mode'}
                    </Text>
                  </Badge>
                </View>
                <Text className="text-xs text-muted-foreground">
                  {user
                    ? user.email
                    : 'Sign in or create an account to organize your subscriptions under your profile.'}
                </Text>
              </View>
            </View>
          </CardContent>
          <CardFooter className="gap-2 border-t border-border px-5 pt-4">
            {user ? (
              <Button variant="outline" size="sm" onPress={() => void signOut()}>
                <Icon as={LogOut} size={14} className="text-foreground" />
                <Text>Sign out</Text>
              </Button>
            ) : (
              <>
                <Button size="sm" onPress={() => router.push('/(auth)/sign-in')}>
                  <Icon as={LogIn} size={14} className="text-primary-foreground" />
                  <Text>Sign in</Text>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => router.push('/(auth)/sign-up')}
                >
                  <Text>Create account</Text>
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
      </FadeInView>

      {/* Appearance Card */}
      <FadeInView delay={100}>
        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>
              Switch between light and dark theme tokens.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-row flex-wrap items-center justify-between gap-3 px-5">
            <View className="gap-0.5">
              <Text className="text-sm font-medium text-foreground">Color Theme</Text>
              <Text className="text-xs text-muted-foreground">
                Currently active: {colorScheme === 'dark' ? 'Dark' : 'Light'}
              </Text>
            </View>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={colorScheme === 'dark' ? 'dark' : 'light'}
              onValueChange={(val) => {
                if (val === 'light' || val === 'dark') {
                  setPreference(val);
                }
              }}
            >
              <ToggleGroupItem value="light" accessibilityLabel="Light mode">
                <Icon as={Sun} size={14} className="text-foreground" />
                <Text>Light</Text>
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" accessibilityLabel="Dark mode">
                <Icon as={Moon} size={14} className="text-foreground" />
                <Text>Dark</Text>
              </ToggleGroupItem>
            </ToggleGroup>
          </CardContent>
        </Card>
      </FadeInView>

      {/* Workspace Tools (shadcn ItemGroup) */}
      <FadeInView delay={150}>
        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Features & Guides</CardTitle>
            <CardDescription>
              Renewal reminders, savings insights, and privacy documentation.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <ItemGroup className="rounded-lg border border-border">
              <Pressable onPress={() => router.push('/reminders')} accessibilityRole="button">
                <Item size="sm" className="web:hover:bg-accent/50">
                  <ItemMedia variant="icon">
                    <Icon as={Bell} size={16} className="text-foreground" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>Renewal Reminders</ItemTitle>
                    <ItemDescription>
                      Configure notification lead times and inspect scheduled alerts
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Icon as={ChevronRight} size={15} className="text-muted-foreground" />
                  </ItemActions>
                </Item>
              </Pressable>

              <ItemSeparator />

              <Pressable onPress={() => router.push('/savings')} accessibilityRole="button">
                <Item size="sm" className="web:hover:bg-accent/50">
                  <ItemMedia variant="icon">
                    <Icon as={PiggyBank} size={16} className="text-foreground" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>Savings Audit</ItemTitle>
                    <ItemDescription>
                      Inspect duplicate categories, trial expirations, and cancellation candidates
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Icon as={ChevronRight} size={15} className="text-muted-foreground" />
                  </ItemActions>
                </Item>
              </Pressable>

              <ItemSeparator />

              <Pressable onPress={() => router.push('/onboarding')} accessibilityRole="button">
                <Item size="sm" className="web:hover:bg-accent/50">
                  <ItemMedia variant="icon">
                    <Icon as={Sparkles} size={16} className="text-foreground" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>Product Tour</ItemTitle>
                    <ItemDescription>
                      Replay the Leakify onboarding walkthrough
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Icon as={ChevronRight} size={15} className="text-muted-foreground" />
                  </ItemActions>
                </Item>
              </Pressable>

              <ItemSeparator />

              <Pressable onPress={() => router.push('/privacy')} accessibilityRole="button">
                <Item size="sm" className="web:hover:bg-accent/50">
                  <ItemMedia variant="icon">
                    <Icon as={Shield} size={16} className="text-foreground" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>Privacy & Security</ItemTitle>
                    <ItemDescription>
                      How your subscription data is stored and protected
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Icon as={ChevronRight} size={15} className="text-muted-foreground" />
                  </ItemActions>
                </Item>
              </Pressable>
            </ItemGroup>
          </CardContent>
        </Card>
      </FadeInView>

      {/* Data Management Card */}
      <FadeInView delay={200}>
        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Data Management</CardTitle>
            <CardDescription>
              Populate sample subscriptions or reset your local workspace ({subscriptions.length}{' '}
              tracked).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-row flex-wrap items-center gap-2.5 px-5">
            <Button variant="outline" size="sm" loading={busy} onPress={() => void handleSeed()}>
              <Icon as={Database} size={14} className="text-foreground" />
              <Text>Load sample subscriptions</Text>
            </Button>

            {subscriptions.length > 0 ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={busy}>
                    <Icon as={Trash2} size={14} className="text-white" />
                    <Text>Clear all data</Text>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete all subscriptions?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes all {subscriptions.length} tracked subscriptions and
                      cancels their scheduled reminders. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>
                      <Text>Cancel</Text>
                    </AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onPress={() => void handleClear()}
                    >
                      <Text>Delete everything</Text>
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </CardContent>
        </Card>
      </FadeInView>
    </Screen>
  );
}
