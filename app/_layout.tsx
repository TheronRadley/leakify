import '../global.css';

import { LeakifyMark } from '@/components/branding/logo';
import { Text } from '@/components/ui/text';
import { AuthProvider, useAuth, useRouteGuard } from '@/features/auth/auth-context';
import { configureNotificationHandler } from '@/features/notifications/service';
import { useNotificationSync } from '@/features/notifications/use-notification-sync';
import { useDataStore } from '@/features/subscriptions/store';
import { APP_TAGLINE } from '@/lib/constants';
import { ThemeProvider, useSemanticColors } from '@/lib/theme';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export { ErrorBoundary } from 'expo-router';

function SplashScreen() {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background">
      <LeakifyMark size={72} />
      <Text variant="h3" className="text-foreground">
        Leakify
      </Text>
      <Text variant="muted">{APP_TAGLINE}</Text>
      <ActivityIndicator className="mt-2" />
    </View>
  );
}

function NotificationBootstrap() {
  if (!NotificationBootstrap.done) {
    NotificationBootstrap.done = true;
    configureNotificationHandler();
  }
  return null;
}
NotificationBootstrap.done = false as boolean;

function RootStack() {
  const { isBootstrapping } = useAuth();
  const colors = useSemanticColors();
  useRouteGuard();

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="auto" />
      {isBootstrapping ? (
        <SplashScreen />
      ) : (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="subscription/new"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="subscription/[id]/index"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="subscription/[id]/edit"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="savings"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="reminders"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen name="privacy" options={{ headerShown: false }} />
        </Stack>
      )}
      <PortalHost />
    </View>
  );
}

/** Runs the notification sync only once the store exists under providers. */
function NotificationSyncRunner() {
  const { status } = useDataStore();
  if (status === 'idle') return null;
  return <NotificationSyncInner />;
}

function NotificationSyncInner() {
  useNotificationSync();
  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NotificationBootstrap />
          <RootStack />
          <NotificationSyncRunner />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
