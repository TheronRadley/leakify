import { FormField } from '@/components/shared/form-field';
import { Screen } from '@/components/shared/screen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth/auth-context';
import { recoverySchema, type RecoveryValues } from '@/lib/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

export default function RecoverScreen() {
  const router = useRouter();
  const { recoverPassword } = useAuth();
  const [sent, setSent] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<RecoveryValues>({
    resolver: zodResolver(recoverySchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await recoverPassword(values.email);
      setSent(true);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not send the email. Try again later.');
    }
  });

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="gap-1 pb-6 pt-10">
        <Text variant="h3">Reset your password</Text>
        <Text variant="muted">We will email you a secure recovery link.</Text>
      </View>
      {sent ? (
        <View className="gap-4">
          <Text className="leading-6 text-muted-foreground">
            Check your inbox — if an account exists for that address, a recovery link is on
            its way. The link opens Leakify and lets you set a new password.
          </Text>
          <Button onPress={() => router.replace('/(auth)/sign-in')} accessibilityLabel="Back to sign in">
            <Text>Back to sign in</Text>
          </Button>
        </View>
      ) : (
        <View className="gap-4">
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
                />
              </FormField>
            )}
          />
          {serverError ? (
            <Text variant="small" className="text-destructive" accessibilityRole="alert">
              {serverError}
            </Text>
          ) : null}
          <Button loading={isSubmitting} onPress={onSubmit} accessibilityLabel="Send recovery email">
            <Text>Send recovery email</Text>
          </Button>
          <Button variant="ghost" onPress={() => router.back()} accessibilityLabel="Go back">
            <Text className="text-muted-foreground">Go back</Text>
          </Button>
        </View>
      )}
    </Screen>
  );
}
