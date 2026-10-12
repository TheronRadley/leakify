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
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
const storage =
  Platform.OS === 'web'
    ? AsyncStorage
    : {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
      };

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
        detectSessionInUrl: Platform.OS === 'web',
        // PKCE, explicitly. supabase-js defaults to the implicit flow, which
        // puts access tokens in the redirect URL (browser history, logs,
        // referrers). With PKCE the email link carries a one-time code that
        // app/(auth)/auth-callback.tsx exchanges for a session, and the code
        // verifier stays in the secure storage above (audit S-03).
        flowType: 'pkce',
      },
    });
  }
  return client;
}
