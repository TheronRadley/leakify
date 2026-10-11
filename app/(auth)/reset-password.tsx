import { FormField } from '@/components/shared/form-field';
import { Screen } from '@/components/shared/screen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth/auth-context';
import { passwordSchema } from '@/lib/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

const resetSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetValues = z.input<typeof resetSchema>;

/**
 * Final step of password recovery, reached from `/auth/callback` after a code
 * was exchanged for a recovery session. The password goes to `updateUser` only;
 * it is never kept in component state beyond the form, and never logged.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { setNewPassword, user, signOut } = useAuth();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { password: '', confirmPassword: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await setNewPassword(values.password);
      setDone(true);
      router.replace('/(tabs)');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'The password could not be updated.');
    }
  });

  if (!user && !done) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View className="gap-4 pb-6">
          <Text variant="h3">No active recovery</Text>
          <Text variant="muted">
            A recovery link has to be opened first — it authorizes this change and then expires. If
            you already opened one, it may have been used on another device.
          </Text>
          <Button onPress={() => router.replace('/(auth)/recover')} accessibilityLabel="Request a new recovery link">
            <Text>Request a new link</Text>
          </Button>
          <Button variant="ghost" onPress={() => void signOut().then(() => router.replace('/(auth)/sign-in'))}>
            <Text className="text-muted-foreground">Back to sign in</Text>
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="gap-1 pb-6 pt-10">
        <Text variant="h3">Choose a new password</Text>
        <Text variant="muted">Signed in as {user?.email ?? 'your account'} — this link only works once.</Text>
      </View>
      <View className="gap-4">
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormField label="New password" error={errors.password?.message} hint="At least 8 characters.">
              <Input
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                autoCapitalize="none"
                textContentType="newPassword"
                accessibilityLabel="New password"
              />
            </FormField>
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormField label="Confirm new password" error={errors.confirmPassword?.message}>
              <Input
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                autoCapitalize="none"
                textContentType="newPassword"
                accessibilityLabel="Confirm new password"
              />
            </FormField>
          )}
        />
        {serverError ? (
          <Text variant="small" className="text-destructive" accessibilityRole="alert">
            {serverError}
          </Text>
        ) : null}
        <Button loading={isSubmitting} onPress={onSubmit} accessibilityLabel="Save new password">
          <Text>Save new password</Text>
        </Button>
      </View>
    </Screen>
  );
}
