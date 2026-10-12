/**
 * Deep-link / redirect target for Supabase email links (PKCE).
 *
 * Supabase sends the user here with `?code=…&type=recovery`. This screen
 * exchanges the code for a session and then hands off:
 *   - recovery link  → /(auth)/reset-password (choose a new password)
 *   - anything else  → /(tabs)
 *
 * The exchange happens exactly once per mount: a PKCE code is single-use, and
 * React 19 Strict Mode double-invokes effects in development.
 */
import { LeakifyMark } from '@/components/branding/logo';
import { Screen } from '@/components/shared/screen';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth/auth-context';
import { parseAuthCallback, type AuthCredentials } from '@/lib/auth-links';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

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
      // Native: expo-router already parsed the deep link's query into params.
      // Web: also read the fragment, which is where a legacy implicit-flow
      // link leaves its tokens.
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
          : { kind: 'tokens', accessToken: result.accessToken, refreshToken: result.refreshToken };

      try {
        await exchangeAuthCallback(credentials);
      } catch (err) {
        setFailure(err instanceof Error ? err.message : 'That link could not be completed.');
        return;
      }
      // Recovery links are the only ones this app generates; default to the
      // reset form when the `type` hint is missing so the user still gets to
      // set a password.
      if (result.type === 'recovery' || result.type === 'unknown') {
        router.replace('/(auth)/reset-password');
      } else {
        router.replace('/(tabs)');
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot effect; the guard above makes the deps irrelevant
  }, []);

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="items-center gap-4 pb-8 pt-16">
        <LeakifyMark size={48} />
        {failure ? (
          <View className="gap-4">
            <Text variant="h3" className="text-center">
              Link not completed
            </Text>
            <Text className="text-center leading-6 text-muted-foreground" accessibilityRole="alert">
              {failure}
            </Text>
            <Button
              onPress={() => router.replace('/(auth)/sign-in')}
              accessibilityLabel="Back to sign in"
            >
              <Text>Back to sign in</Text>
            </Button>
          </View>
        ) : (
          <View className="items-center gap-3">
            <Text variant="h3">Opening Leakify…</Text>
            <Text variant="muted" className="text-center">
              Verifying your link.
            </Text>
            <ActivityIndicator accessibilityLabel="Verifying link" />
          </View>
        )}
      </View>
    </Screen>
  );
}
