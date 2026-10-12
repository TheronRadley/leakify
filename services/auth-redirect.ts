/**
 * Runtime half of the auth deep-link handling: where Supabase should send the
 * user back after they click an email link.
 *
 * The value must be an EXACT match for one of the URLs listed in the Supabase
 * dashboard (Authentication → URL Configuration → Redirect URLs). Wildcards
 * only apply to sub-paths, so publish:
 *   - https://<your-web-host>/auth-callback            (web build)
 *   - leakify://auth-callback                          (iOS / Android release)
 *   - exp://127.0.0.1:8081/--/auth-callback            (Expo dev client, if used)
 * See README → "Cloud sync with Supabase".
 */
import { AUTH_CALLBACK_PATH } from '@/lib/auth-links';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/**
 * Absolute URL Supabase should redirect to after an email link is followed.
 *
 * Native: built from the app's registered scheme (`leakify://` in app.json) via
 * expo-linking, which also produces the right value inside a dev client.
 * Web: the current origin, so a self-hosted or preview deployment works without
 * configuration — but it must still be allow-listed in the dashboard.
 */
export function authRedirectUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/${AUTH_CALLBACK_PATH}`;
  }
  return Linking.createURL(`/${AUTH_CALLBACK_PATH}`);
}
