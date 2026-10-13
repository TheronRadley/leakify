import { FormField } from '@/components/shared/form-field';
import { ErrorBanner, InfoBanner } from '@/components/ui/auth-bits';
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
import { RECOVERY_SENT_COPY } from '@/lib/auth-links';
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

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecoveryValues>({
    resolver: zodResolver(recoverySchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await recoverPassword(values.email);
      setSent(true);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Could not send the email. Try again later.',
      );
    }
  });

  return (
    <View className="w-full">
      <Card>
        <CardHeader className="items-center text-center">
          <CardTitle className="text-xl">Reset your password</CardTitle>
          <CardDescription className="text-center">
            We will email you a secure recovery link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <FieldGroup className="gap-4">
              <InfoBanner message={RECOVERY_SENT_COPY} />
              <Button
                onPress={() => router.replace('/(auth)/sign-in')}
                accessibilityLabel="Back to sign in"
                className="w-full"
              >
                <Text>Back to sign in</Text>
              </Button>
            </FieldGroup>
          ) : (
            <FieldGroup className="gap-4">
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
                      keyboardType="email-address"
                    />
                  </FormField>
                )}
              />
              <Button
                loading={isSubmitting}
                onPress={onSubmit}
                accessibilityLabel="Send recovery email"
                className="w-full"
              >
                <Text>Send recovery email</Text>
              </Button>
              <Button
                variant="ghost"
                onPress={() => router.back()}
                accessibilityLabel="Go back"
                className="w-full"
              >
                <Text className="text-muted-foreground">Go back</Text>
              </Button>
            </FieldGroup>
          )}
        </CardContent>
      </Card>
    </View>
  );
}
