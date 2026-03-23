import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme, type Theme } from './theme';

export type { Theme };

export type ThemePreference = 'light' | 'dark' | 'system';

const ThemeContext = createContext<Theme | null>(null);

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

export function ThemeProvider({
  children,
  preference,
}: {
  children: React.ReactNode;
  preference: ThemePreference;
}) {
  const sys = useColorScheme();
  const theme = useMemo<Theme>(() => {
    if (preference === 'light') return lightTheme;
    if (preference === 'dark')  return darkTheme;
    return sys === 'dark' ? darkTheme : lightTheme;
  }, [preference, sys]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
