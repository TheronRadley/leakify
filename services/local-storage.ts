/**
 * Thin typed wrapper over AsyncStorage for local / demo mode persistence.
 * Keys are namespaced per user scope so demo data stays separate from real
 * user data (`demo` vs user ids).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'leakify';

export const storageKeys = {
  onboardingCompleted: `${PREFIX}.onboarding.completed`,
  dataMode: `${PREFIX}.data.mode`,
  theme: `${PREFIX}.theme`,
  subscriptions: (scope: string) => `${PREFIX}.subscriptions.${scope}`,
  profile: (scope: string) => `${PREFIX}.profile.${scope}`,
  notificationSettings: (scope: string) => `${PREFIX}.notifications.settings.${scope}`,
  scheduledNotifications: (scope: string) => `${PREFIX}.notifications.scheduled.${scope}`,
  billingEvents: (scope: string) => `${PREFIX}.billing.events.${scope}`,
};

export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeKey(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}
