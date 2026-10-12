/**
 * Choose a new password after a recovery link has been verified.
 *
 * Reached only from app/(auth)/auth-callback.tsx, which has already exchanged
 * the email link's code for a session. Submitting updates the password through
 * supabase.auth.updateUser and then enters cloud mode.
 */
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
import { z } from 'zod';
import { View } from 'react-native';

const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { completePasswordReset } = useAuth();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await completePasswordReset(values.password);
      router.replace('/(tabs)');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not update your password.');
    }
  });

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="gap-1 pb-6 pt-10">
        <Text variant="h3">Choose a new password</Text>
        <Text variant="muted">
          Your link was verified. Pick a new password to finish resetting your account.
        </Text>
      </View>

      <View className="gap-4">
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormField label="New password" error={errors.password?.message}>
              <Input
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="At least 8 characters"
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
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
                placeholder="Repeat it"
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
              />
            </FormField>
          )}
        />
        {serverError ? (
          <Text variant="small" className="text-destructive" accessibilityRole="alert">
            {serverError}
          </Text>
        ) : null}
        <Button loading={isSubmitting} onPress={onSubmit} accessibilityLabel="Update password">
          <Text>Update password</Text>
        </Button>
        <Button
          variant="ghost"
          onPress={() => router.replace('/(auth)/sign-in')}
          accessibilityLabel="Cancel and go to sign in"
        >
          <Text className="text-muted-foreground">Cancel</Text>
        </Button>
      </View>
    </Screen>
  );
}
