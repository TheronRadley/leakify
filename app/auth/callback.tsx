import { Screen } from '@/components/shared/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth/auth-context';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { CheckCircle2, ShieldAlert } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

/**
 * Landing route for recovery/confirmation links:
 *   leakify://auth/callback?code=…      (native)
 *   https://<host>/auth/callback?code=… (web)
 *
 * It does one thing: hand the link to `completeAuthCallback`, which parses it,
 * exchanges the PKCE code for a session, and reports the outcome. The link
 * itself is never stored, logged or rendered. On web the Supabase client may
 * already have consumed the redirect, so a session that turned up without a
 * link is treated as success rather than failure.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { completeAuthCallback, user } = useAuth();
  const [status, setStatus] = React.useState<'working' | 'done' | 'cancelled' | 'failed'>('working');
  const started = React.useRef(false);

  const handle = React.useCallback(
    async (url: string | null) => {
      const result = await completeAuthCallback(url);
      if (result === 'recovery') {
        setStatus('done');
        // Replace, so "back" cannot replay a single-use code.
        router.replace('/(auth)/reset-password');
        return;
      }
      setStatus(result === 'cancelled' ? 'cancelled' : 'failed');
    },
    [completeAuthCallback, router],
  );

  // Cold start: the link is the initial URL.
  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    void Linking.getInitialURL()
      .then((url) => {
        if (url) return handle(url);
        // Web: the client consumes ?code= itself during createClient, so a live
        // session without a link here still means "you got in".
        if (user) {
          setStatus('done');
          router.replace('/(auth)/reset-password');
          return undefined;
        }
        setStatus('failed');
        return undefined;
      })
      .catch(() => setStatus('failed'));
  }, [handle, router, user]);

  // Warm link: the app was already open when the email was tapped.
  React.useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      started.current = true;
      void handle(event.url);
    });
    return () => subscription.remove();
  }, [handle]);

  return (
    <Screen edges={['top', 'bottom']}>
      <Card className="gap-4 p-6">
        <Icon
          as={status === 'done' ? CheckCircle2 : ShieldAlert}
          size={28}
          className={status === 'done' ? 'text-primary' : 'text-muted-foreground'}
        />
        <View className="gap-2">
          <Text variant="h4">
            {status === 'working'
              ? 'Checking your link…'
              : status === 'done'
                ? 'Link verified'
                : status === 'cancelled'
                  ? 'Sign-in cancelled'
                  : 'That link did not work'}
          </Text>
          <Text variant="muted">
            {status === 'failed'
              ? 'Recovery links are single-use and expire quickly. Request a new one and open it on this device.'
              : status === 'cancelled'
                ? 'You closed the confirmation page before it finished. Request a new link whenever you are ready.'
                : 'Now choose a new password for your account.'}
          </Text>
        </View>

        {status === 'done' ? null : (
          <Button
            variant={status === 'failed' ? 'default' : 'outline'}
            onPress={() => router.replace('/(auth)/recover')}
            accessibilityLabel="Request a new recovery link"
          >
            <Text>Request a new link</Text>
          </Button>
        )}
        <Button variant="ghost" onPress={() => router.replace('/(auth)/sign-in')}>
          <Text className="text-muted-foreground">Back to sign in</Text>
        </Button>
      </Card>
    </Screen>
  );
}
