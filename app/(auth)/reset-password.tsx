import { FormField } from '@/components/shared/form-field';
import { ErrorBanner, PasswordInput } from '@/components/ui/auth-bits';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth/auth-context';
import { passwordSchema } from '@/lib/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

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
    <View className="w-full">
      <Card>
        <CardHeader className="items-center text-center">
          <CardTitle className="text-xl">Choose a new password</CardTitle>
          <CardDescription className="text-center">
            Your link was verified. Pick a new password to finish resetting your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-4">
            <ErrorBanner message={serverError} />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField label="New password" error={errors.password?.message}>
                  <PasswordInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="At least 8 characters"
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
                  <PasswordInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Repeat it"
                    autoComplete="new-password"
                    textContentType="newPassword"
                  />
                </FormField>
              )}
            />
            <Button
              loading={isSubmitting}
              onPress={onSubmit}
              accessibilityLabel="Update password"
              className="w-full"
            >
              <Text>Update password</Text>
            </Button>
            <Button
              variant="ghost"
              onPress={() => router.replace('/(auth)/sign-in')}
              accessibilityLabel="Cancel and go to sign in"
              className="w-full"
            >
              <Text className="text-muted-foreground">Cancel</Text>
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
    </View>
  );
}
