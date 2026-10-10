import { FormField } from '@/components/shared/form-field';
import { Screen } from '@/components/shared/screen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth/auth-context';
import { signUpSchema, type SignUpValues } from '@/lib/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setNotice(null);
    try {
      await signUp(values.email, values.password, values.displayName);
      router.replace('/(tabs)');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-up failed. Please try again.';
      // Email-confirmation flow surfaces as an informational notice.
      if (message.toLowerCase().includes('inbox')) setNotice(message);
      else setServerError(message);
    }
  });

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="gap-1 pb-6 pt-10">
        <Text variant="h3">Create your account</Text>
        <Text variant="muted">Sync and back up your subscriptions securely.</Text>
      </View>
      <View className="gap-4">
        <Controller
          control={control}
          name="displayName"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormField label="Display name" error={errors.displayName?.message}>
              <Input value={value} onChangeText={onChange} onBlur={onBlur} placeholder="Alex Rivera" autoComplete="name" />
            </FormField>
          )}
        />
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
                keyboardType="email-address"
                autoComplete="email"
              />
            </FormField>
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormField label="Password" error={errors.password?.message} hint="At least 8 characters">
              <Input
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="••••••••"
                secureTextEntry
                autoComplete="new-password"
              />
            </FormField>
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormField label="Confirm password" error={errors.confirmPassword?.message}>
              <Input value={value} onChangeText={onChange} onBlur={onBlur} placeholder="••••••••" secureTextEntry />
            </FormField>
          )}
        />
        {serverError ? (
          <Text variant="small" className="text-destructive" accessibilityRole="alert">
            {serverError}
          </Text>
        ) : null}
        {notice ? (
          <Text variant="small" className="text-primary" accessibilityLiveRegion="polite">
            {notice}
          </Text>
        ) : null}
        <Button loading={isSubmitting} onPress={onSubmit} accessibilityLabel="Create account">
          <Text>Create account</Text>
        </Button>
        <Button variant="ghost" onPress={() => router.back()} accessibilityLabel="Back to sign in">
          <Text className="text-muted-foreground">Back to sign in</Text>
        </Button>
      </View>
    </Screen>
  );
}
