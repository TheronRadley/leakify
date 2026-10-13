/**
 * Theme management. Wraps NativeWind's color scheme handling with a persisted
 * user preference (system / light / dark) and exposes resolved scheme +
 * shadcn/ui Zinc semantic colors for places that need raw values (icons, tab bar).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { storageKeys } from '@/services/local-storage';
import type { Profile } from '@/types';

export type ThemePreference = Profile['themePreference'];

interface ThemeContextValue {
  colorScheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colorScheme: 'light',
  preference: 'system',
  setPreference: () => undefined,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colorScheme, setColorScheme } = useNativeWindColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(storageKeys.theme).then((raw) => {
      if (mounted && (raw === 'light' || raw === 'dark' || raw === 'system')) {
        setPreferenceState(raw);
        setColorScheme(raw);
      }
    });
    return () => {
      mounted = false;
    };
  }, [setColorScheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colorScheme: colorScheme ?? 'light',
      preference,
      setPreference: (pref) => {
        setPreferenceState(pref);
        setColorScheme(pref);
        AsyncStorage.setItem(storageKeys.theme, pref).catch(() => undefined);
      },
    }),
    [colorScheme, preference, setColorScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/** Semantic colors (shadcn/ui Zinc palette) for imperative APIs that cannot consume CSS variables. */
export const SEMANTIC_COLORS = {
  light: {
    background: '#FFFFFF',
    card: '#FFFFFF',
    foreground: '#09090B',
    muted: '#71717A',
    border: '#E4E4E7',
    primary: '#18181B',
    primaryForeground: '#FAFAFA',
    secondary: '#F4F4F5',
    warning: '#D97706',
    destructive: '#E11D48',
    navy: '#09090B',
  },
  dark: {
    background: '#09090B',
    card: '#18181B',
    foreground: '#FAFAFA',
    muted: '#A1A1AA',
    border: '#27272A',
    primary: '#FAFAFA',
    primaryForeground: '#18181B',
    secondary: '#27272A',
    warning: '#F59E0B',
    destructive: '#F87171',
    navy: '#09090B',
  },
} as const;

export function useSemanticColors() {
  const { colorScheme } = useAppTheme();
  return SEMANTIC_COLORS[colorScheme];
}
