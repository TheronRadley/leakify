/**
 * Supabase client. Configured exclusively through public env vars
 * (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY). The anon key is
 * safe for client use because every table is protected by Row Level Security
 * (see supabase/migrations) — service-role keys must NEVER ship in the app.
 *
 * When not configured the app runs fully in local/demo mode and no network
 * calls are made.
 */
import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildRedirectTarget } from '@/lib/auth-links';
import { createChunkedStorage } from '@/services/secure-store-adapter';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl.startsWith('http') && supabaseAnonKey.length > 20,
);

/**
 * Auth token storage: expo-secure-store on native (encrypted, platform
 * keychain/keystore backed), AsyncStorage fallback on web where SecureStore
 * does not exist.
 */
/**
 * Native session storage: the keychain/keystore through expo-secure-store, wrapped
 * in a chunking adapter because SecureStore caps a value near 2 KB and a Supabase
 * session (plus its PKCE code verifier) can exceed that. Without the adapter a
 * long session is truncated on write, which shows up as an app that loses sign-in
 * — or a recovery link whose verifier can no longer be found.
 */
const secureBackend = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  // deleteItemAsync throws when the key is absent; that is not an error here.
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // already gone
    }
  },
};

const storage =
  Platform.OS === 'web'
    ? AsyncStorage
    : createChunkedStorage(secureBackend);

/** Where email links send the user back to. Mirrors the project allow-list. */
export function authRedirectTarget(path = '/auth/callback'): string | undefined {
  const webOrigin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : null;
  const configuredScheme = Constants.expoConfig?.scheme;
  const scheme = Array.isArray(configuredScheme) ? configuredScheme[0] : (configuredScheme ?? 'leakify');
  return buildRedirectTarget({ scheme, webOrigin, path });
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable cloud sync.',
    );
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage,
        autoRefreshToken: true,
        persistSession: true,
        // PKCE (authorization code + verifier kept on-device) instead of
        // putting a token in a URL. Web still auto-consumes its redirect; native
        // links are exchanged by app/auth/callback via exchangeCodeForSession.
        flowType: 'pkce',
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
  }
  return client;
}
