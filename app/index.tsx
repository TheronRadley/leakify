import { useAuth } from '@/features/auth/auth-context';
import { Redirect } from 'expo-router';

/** Entry redirect: the route guard in _layout handles the state machine. */
export default function Index() {
  const { onboardingCompleted, dataMode } = useAuth();
  if (!onboardingCompleted) return <Redirect href="/onboarding" />;
  if (!dataMode) return <Redirect href="/(auth)/sign-in" />;
  return <Redirect href="/(tabs)" />;
}
