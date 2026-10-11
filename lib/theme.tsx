/**
 * Theme management. Wraps NativeWind's color scheme handling with a persisted
 * user preference (system / light / dark) and exposes resolved scheme +
 * brand-semantic colors for places that need raw values (icons, tab bar).
 */

import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { readRaw, storageKeys, writeRaw } from '@/services/local-storage';
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
    readRaw(storageKeys.theme).then((raw) => {
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
        writeRaw(storageKeys.theme, pref);
      },
    }),
    [colorScheme, preference, setColorScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/** Semantic colors for imperative APIs that cannot consume CSS variables. */
export const SEMANTIC_COLORS = {
  light: {
    background: '#F8FAFC',
    card: '#FFFFFF',
    foreground: '#101828',
    muted: '#667085',
    border: '#E4E7EC',
    primary: '#16A34A',
    warning: '#F59E0B',
    destructive: '#DC2626',
    navy: '#101828',
  },
  dark: {
    background: '#0B1424',
    card: '#141F31',
    foreground: '#F2F5F7',
    muted: '#9AA7B8',
    border: '#243042',
    primary: '#22C55E',
    warning: '#FBBF24',
    destructive: '#F87171',
    navy: '#0B1424',
  },
} as const;

export function useSemanticColors() {
  const { colorScheme } = useAppTheme();
  return SEMANTIC_COLORS[colorScheme];
}
