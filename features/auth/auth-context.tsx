/**
 * Authentication + data-mode context.
 *
 * Three honest modes:
 *  - demo:     seeded sample data in the isolated `demo` storage scope.
 *  - local:    the user's own data, stored on-device only (no account).
 *  - supabase: authenticated cloud sync, only selectable when the public
 *              Supabase env config is present. When it is not, those paths
 *              are disabled in the UI — we never claim sync that is not
 *              actually configured.
 */
import {
  initializeStore,
} from '@/features/subscriptions/store';
import { readJSON, storageKeys, writeJSON } from '@/services/local-storage';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import type { AuthUser, DataMode } from '@/types';
import { useRouter, useSegments } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import * as React from 'react';

interface AuthState {
  isBootstrapping: boolean;
  onboardingCompleted: boolean;
  dataMode: DataMode | null;
  user: AuthUser | null;
}

interface AuthActions {
  completeOnboarding: () => Promise<void>;
  enterDemoMode: () => Promise<void>;
  enterLocalMode: () => Promise<void>;
  resetChoice: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  recoverPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<(AuthState & AuthActions) | null>(null);

function sessionToUser(session: Session | null): AuthUser | null {
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email ?? '' };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({
    isBootstrapping: true,
    onboardingCompleted: false,
    dataMode: null,
    user: null,
  });

  const boot = React.useCallback(async () => {
    const [onboardingDone, savedMode] = await Promise.all([
      readJSON<boolean>(storageKeys.onboardingCompleted, false),
      readJSON<DataMode | null>(storageKeys.dataMode, null),
    ]);

    if (savedMode === 'supabase' && isSupabaseConfigured) {
      const supabase = getSupabase();
      const { data } = await supabase.auth.getSession();
      const user = sessionToUser(data.session);
      if (user) {
        await initializeStore('supabase', user.id);
        setState({ isBootstrapping: false, onboardingCompleted: onboardingDone, dataMode: 'supabase', user });
        return;
      }
      // Session lost — fall back to the mode picker.
      await writeJSON(storageKeys.dataMode, null);
      setState({ isBootstrapping: false, onboardingCompleted: onboardingDone, dataMode: null, user: null });
      return;
    }

    if (savedMode === 'demo' || savedMode === 'local') {
      await initializeStore(savedMode, savedMode === 'demo' ? 'demo' : 'local-user', {
        seedDemo: savedMode === 'demo',
      });
      // State update happens after async bootstrap work (external system sync).

      setState({ isBootstrapping: false, onboardingCompleted: onboardingDone, dataMode: savedMode, user: null });
      return;
    }


    setState({ isBootstrapping: false, onboardingCompleted: onboardingDone, dataMode: null, user: null });
  }, []);

  React.useEffect(() => {
    // boot() only updates state after async storage/session work completes;
    // it synchronizes React with external systems (AsyncStorage, auth session),
    // which is exactly what effects are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async bootstrap; no synchronous setState in the effect body
    void boot();
  }, [boot]);

  // Keep session changes in sync (token refresh, sign-out elsewhere).
  React.useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    const supabase = getSupabase();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setState((s) => ({ ...s, user: null, dataMode: null }));
      } else if (event === 'TOKEN_REFRESHED' && session) {
        setState((s) => ({ ...s, user: sessionToUser(session) }));
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const actions = React.useMemo<AuthActions>(
    () => ({
      completeOnboarding: async () => {
        await writeJSON(storageKeys.onboardingCompleted, true);
        setState((s) => ({ ...s, onboardingCompleted: true }));
      },
      enterDemoMode: async () => {
        setState((s) => ({ ...s, isBootstrapping: true }));
        await writeJSON(storageKeys.dataMode, 'demo' satisfies DataMode);
        await initializeStore('demo', 'demo', { seedDemo: true });
        setState({ isBootstrapping: false, onboardingCompleted: true, dataMode: 'demo', user: null });
        await writeJSON(storageKeys.onboardingCompleted, true);
      },
      enterLocalMode: async () => {
        setState((s) => ({ ...s, isBootstrapping: true }));
        await writeJSON(storageKeys.dataMode, 'local' satisfies DataMode);
        await initializeStore('local', 'local-user');
        setState({ isBootstrapping: false, onboardingCompleted: true, dataMode: 'local', user: null });
        await writeJSON(storageKeys.onboardingCompleted, true);
      },
      resetChoice: async () => {
        await writeJSON(storageKeys.dataMode, null);
        setState({ isBootstrapping: false, onboardingCompleted: true, dataMode: null, user: null });
      },
      signIn: async (email, password) => {
        if (!isSupabaseConfigured) throw new Error('Cloud sign-in is not configured for this build.');
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(mapAuthError(error.message));
        const user = sessionToUser(data.session);
        if (!user) throw new Error('Sign-in failed. Please try again.');
        await writeJSON(storageKeys.dataMode, 'supabase' satisfies DataMode);
        await initializeStore('supabase', user.id);
        setState((s) => ({ ...s, dataMode: 'supabase', user }));
      },
      signUp: async (email, password, displayName) => {
        if (!isSupabaseConfigured) throw new Error('Cloud accounts are not configured for this build.');
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        if (error) throw new Error(mapAuthError(error.message));
        const user = sessionToUser(data.session);
        if (user) {
          await writeJSON(storageKeys.dataMode, 'supabase' satisfies DataMode);
          await initializeStore('supabase', user.id);
          setState((s) => ({ ...s, dataMode: 'supabase', user }));
        } else {
          // Email confirmation required: user verified by email before session exists.
          throw new Error('Check your inbox to confirm your email, then sign in.');
        }
      },
      recoverPassword: async (email) => {
        if (!isSupabaseConfigured) throw new Error('Cloud sign-in is not configured for this build.');
        const supabase = getSupabase();
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw new Error('Could not send the recovery email. Please try again later.');
      },
      signOut: async () => {
        if (isSupabaseConfigured) {
          try {
            await getSupabase().auth.signOut();
          } catch {
            // Signing out must never fail visibly — clear local state regardless.
          }
        }
        await writeJSON(storageKeys.dataMode, null);
        setState({ isBootstrapping: false, onboardingCompleted: true, dataMode: null, user: null });
      },
    }),
    [],
  );

  return <AuthContext.Provider value={{ ...state, ...actions }}>{children}</AuthContext.Provider>;
}

/** Supabase auth error strings mapped to human, non-sensitive messages. */
function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login')) return 'Incorrect email or password.';
  if (lower.includes('already registered')) return 'An account with this email already exists.';
  if (lower.includes('password')) return 'Password does not meet the requirements.';
  if (lower.includes('rate limit') || lower.includes('too many')) return 'Too many attempts. Please wait a moment.';
  return 'Authentication failed. Please try again.';
}

export function useAuth(): AuthState & AuthActions {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/**
 * Route protection effect: redirects between onboarding, the mode picker and
 * the app shell based on the current auth state.
 */
export function useRouteGuard() {
  const { isBootstrapping, onboardingCompleted, dataMode } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  React.useEffect(() => {
    if (isBootstrapping) return;
    const inTabs = segments[0] === '(tabs)';
    const inOnboarding = segments[0] === 'onboarding';
    const inAuth = segments[0] === '(auth)';
    const inUtilityScreen =
      segments[0] === 'subscription' || segments[0] === 'savings' || segments[0] === 'reminders';

    if (!onboardingCompleted && !inOnboarding) {
      router.replace('/onboarding');
      return;
    }
    if (onboardingCompleted && !dataMode && !inAuth && !inOnboarding) {
      router.replace('/(auth)/sign-in');
      return;
    }
    if (onboardingCompleted && dataMode && !inTabs && !inUtilityScreen) {
      router.replace('/(tabs)');
    }
  }, [isBootstrapping, onboardingCompleted, dataMode, segments, router]);
}
