import { LeakifyMark } from '@/components/branding/logo';
import { Screen } from '@/components/shared/screen';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth/auth-context';
import { parseAuthCallback, type AuthCredentials } from '@/lib/auth-links';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';

function paramsToSearch(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.length > 0) search.set(key, value);
  }
  return search.toString();
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const { exchangeAuthCallback } = useAuth();
  const [failure, setFailure] = React.useState<string | null>(null);
  const attempted = React.useRef(false);

  React.useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const run = async () => {
      const hash = typeof window !== 'undefined' ? (window.location.hash ?? '') : '';
      const result = parseAuthCallback(paramsToSearch(params), hash);

      if (result.kind === 'error') {
        setFailure(result.description);
        return;
      }
      if (result.kind === 'empty') {
        setFailure(
          'This screen opens from a Leakify email link. Nothing to complete here — request a new link from the sign-in screen.',
        );
        return;
      }

      const credentials: AuthCredentials =
        result.kind === 'code'
          ? { kind: 'code', code: result.code }
          : {
              kind: 'tokens',
              accessToken: result.accessToken,
              refreshToken: result.refreshToken,
            };

      try {
        await exchangeAuthCallback(credentials);
      } catch (err) {
        setFailure(err instanceof Error ? err.message : 'That link could not be completed.');
        return;
      }
      if (result.type === 'recovery' || result.type === 'unknown') {
        router.replace('/(auth)/reset-password');
      } else {
        router.replace('/(tabs)');
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot effect
  }, []);

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mx-auto w-full max-w-sm pt-16">
        <Card className="items-center text-center">
          <CardHeader className="items-center text-center">
            <View className="mb-2">
              <LeakifyMark size={44} />
            </View>
            <CardTitle className="text-xl">
              {failure ? 'Link not completed' : 'Opening Leakify…'}
            </CardTitle>
            <CardDescription className="text-center">
              {failure ? 'Could not verify this authentication link' : 'Verifying your link.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="w-full items-center gap-4">
            {failure ? (
              <>
                <Text
                  className="text-center text-sm leading-6 text-muted-foreground"
                  accessibilityRole="alert"
                >
                  {failure}
                </Text>
                <Button
                  onPress={() => router.replace('/(auth)/sign-in')}
                  accessibilityLabel="Back to sign in"
                  className="w-full"
                >
                  <Text>Back to sign in</Text>
                </Button>
              </>
            ) : (
              <Spinner size={20} className="text-foreground" accessibilityLabel="Verifying link" />
            )}
          </CardContent>
        </Card>
      </View>
    </Screen>
  );
}
