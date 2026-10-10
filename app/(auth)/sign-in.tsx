import { LeakifyLogo } from '@/components/branding/logo';
import { FormField } from '@/components/shared/form-field';
import { Screen } from '@/components/shared/screen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link as UILink, Text } from '@/components/ui/auth-bits';
import { useAuth } from '@/features/auth/auth-context';
import { APP_TAGLINE } from '@/lib/constants';
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

  const { control, handleSubmit, formState: { errors } } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
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
    <Screen edges={['top', 'bottom']}>
      <View className="items-center gap-2 pb-8 pt-10">
        <LeakifyLogo size={40} />
        <Text variant="muted">{APP_TAGLINE}</Text>
      </View>

      {isSupabaseConfigured ? (
        <View className="gap-4" accessibilityLabel="Sign-in form">
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
                <Input
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="••••••••"
                  secureTextEntry
                  autoComplete="password"
                  textContentType="password"
                />
              </FormField>
            )}
          />
          {serverError ? (
            <Text variant="small" className="text-destructive" accessibilityRole="alert">
              {serverError}
            </Text>
          ) : null}
          <Button loading={busy === 'signin'} disabled={busy !== null} onPress={onSubmit} accessibilityLabel="Sign in">
            <Text>Sign in</Text>
          </Button>
          <View className="flex-row justify-center gap-1">
            <UILink href="/(auth)/recover">Forgot password?</UILink>
            <Text variant="muted">·</Text>
            <UILink href="/(auth)/sign-up">Create account</UILink>
          </View>
        </View>
      ) : (
        <View className="gap-4 px-1">
          <Text className="text-center leading-6 text-muted-foreground">
            This build runs without cloud accounts, so your data stays entirely on this
            device. Start manually, or explore the demo first.
          </Text>
          <Button onPress={() => void startLocal()} loading={busy === 'local'} disabled={busy !== null} accessibilityLabel="Start without an account">
            <Text>Start without an account</Text>
          </Button>
          <Button variant="outline" onPress={() => void startDemo()} loading={busy === 'demo'} disabled={busy !== null} accessibilityLabel="Explore the demo">
            <Text>Explore the demo</Text>
          </Button>
          <Text variant="small" className="text-center text-muted-foreground">
            To enable sign-in & sync, configure EXPO_PUBLIC_SUPABASE_URL and
            EXPO_PUBLIC_SUPABASE_ANON_KEY (see README).
          </Text>
        </View>
      )}
    </Screen>
  );
}
