import { Stack } from 'expo-router';

/**
 * Auth-link routes (deep links / email redirects). Separate from `(auth)`
 * because these are entered from outside the app and must render without the
 * mode-picker assumptions.
 */
export default function AuthLinkLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
