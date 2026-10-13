import { FormField } from '@/components/shared/form-field';
import { ErrorBanner, InfoBanner, PasswordInput } from '@/components/ui/auth-bits';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
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

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
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
      if (message.toLowerCase().includes('inbox')) setNotice(message);
      else setServerError(message);
    }
  });

  return (
    <View className="w-full">
      <Card>
        <CardHeader className="items-center text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription className="text-center">
            Sync and back up your subscriptions securely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <ErrorBanner message={serverError} />
            <InfoBanner message={notice} />

            <Controller
              control={control}
              name="displayName"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField label="Display name" error={errors.displayName?.message}>
                  <Input
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Alex Rivera"
                    autoComplete="name"
                  />
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
                <FormField
                  label="Password"
                  error={errors.password?.message}
                  hint="At least 8 characters"
                >
                  <PasswordInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="••••••••"
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
                  <PasswordInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="••••••••"
                  />
                </FormField>
              )}
            />
            <Button
              loading={isSubmitting}
              onPress={onSubmit}
              accessibilityLabel="Create account"
              className="w-full"
            >
              <Text>Create account</Text>
            </Button>
            <Button
              variant="ghost"
              onPress={() => router.back()}
              accessibilityLabel="Back to sign in"
              className="w-full"
            >
              <Text className="text-muted-foreground">Back to sign in</Text>
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
    </View>
  );
}
