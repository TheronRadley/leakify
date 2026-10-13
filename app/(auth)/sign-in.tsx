import { FormField } from '@/components/shared/form-field';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ErrorBanner,
  Link as UILink,
  OrDivider,
  PasswordInput,
  Text,
} from '@/components/ui/auth-bits';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FieldDescription, FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { assessModeTransition } from '@/features/subscriptions/mode-transition';
import { countLocalSubscriptions } from '@/features/subscriptions/store';
import { signInSchema, type SignInValues } from '@/lib/validation';
import { isSupabaseConfigured } from '@/services/supabase';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, enterDemoMode, enterLocalMode } = useAuth();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const [localCount, setLocalCount] = React.useState(0);
  const [pendingSignIn, setPendingSignIn] = React.useState<SignInValues | null>(null);

  React.useEffect(() => {
    let mounted = true;
    countLocalSubscriptions()
      .then((count) => {
        if (mounted) setLocalCount(count);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const advice = assessModeTransition({
    from: localCount > 0 ? 'local' : null,
    to: 'supabase',
    itemCount: localCount,
  });

  const performSignIn = async (values: SignInValues) => {
    setServerError(null);
    setBusy('signin');
    try {
      await signIn(values.email, values.password);
      router.replace('/(tabs)');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    if (advice.requiresConfirmation) {
      setPendingSignIn(values);
      return;
    }
    await performSignIn(values);
  });

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

  return (
    <View className="w-full gap-4">
      {isSupabaseConfigured ? (
        <Card accessibilityLabel="Sign-in form">
          <CardHeader className="items-center text-center">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription className="text-center">
              Sign in to sync your subscriptions across devices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <ErrorBanner message={serverError} />

              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormField label="Email" error={errors.email?.message}>
                    <Input
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="you@example.com"
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardType="email-address"
                      textContentType="emailAddress"
                    />
                  </FormField>
                )}
              />
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormField label="Password" error={errors.password?.message}>
                    <PasswordInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="••••••••"
                      autoComplete="password"
                      textContentType="password"
                    />
                  </FormField>
                )}
              />
              <Button
                loading={busy === 'signin'}
                disabled={busy !== null}
                onPress={onSubmit}
                accessibilityLabel="Sign in"
                className="w-full"
              >
                <Text>Sign in</Text>
              </Button>
              <View className="flex-row justify-center gap-1.5">
                <UILink href="/(auth)/recover">Forgot password?</UILink>
                <Text variant="muted">·</Text>
                <UILink href="/(auth)/sign-up">Create account</UILink>
              </View>

              <OrDivider label="Or continue offline" />

              <View className="gap-2">
                <Button
                  variant="outline"
                  onPress={() => void startLocal()}
                  loading={busy === 'local'}
                  disabled={busy !== null}
                  accessibilityLabel="Start without an account"
                  className="w-full"
                >
                  <Text>Start without an account</Text>
                </Button>
                <Button
                  variant="secondary"
                  onPress={() => void startDemo()}
                  loading={busy === 'demo'}
                  disabled={busy !== null}
                  accessibilityLabel="Explore the demo"
                  className="w-full"
                >
                  <Text>Explore the demo</Text>
                </Button>
              </View>
            </FieldGroup>

            <AlertDialog
              open={pendingSignIn !== null}
              onOpenChange={(next) => {
                if (!next) setPendingSignIn(null);
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{advice.headline}</AlertDialogTitle>
                  <AlertDialogDescription>{advice.detail}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    <Text>Not now</Text>
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onPress={() => {
                      const values = pendingSignIn;
                      setPendingSignIn(null);
                      if (values) void performSignIn(values);
                    }}
                  >
                    <Text>Continue</Text>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle className="text-xl">Local-first workspace</CardTitle>
            <CardDescription className="text-center">
              This build runs without cloud accounts, so your data stays entirely on this device.
              Start manually, or explore the demo first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-3">
              <Button
                onPress={() => void startLocal()}
                loading={busy === 'local'}
                disabled={busy !== null}
                accessibilityLabel="Start without an account"
                className="w-full"
              >
                <Text>Start without an account</Text>
              </Button>
              <Button
                variant="outline"
                onPress={() => void startDemo()}
                loading={busy === 'demo'}
                disabled={busy !== null}
                accessibilityLabel="Explore the demo"
                className="w-full"
              >
                <Text>Explore the demo</Text>
              </Button>
              <FieldDescription className="text-center text-xs">
                To enable sign-in & sync, configure EXPO_PUBLIC_SUPABASE_URL and
                EXPO_PUBLIC_SUPABASE_ANON_KEY (see README).
              </FieldDescription>
            </FieldGroup>
          </CardContent>
        </Card>
      )}
    </View>
  );
}
