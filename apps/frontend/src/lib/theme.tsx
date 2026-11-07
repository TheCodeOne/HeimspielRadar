import * as React from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'heimspielradar:theme';

export interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function getSystemResolvedTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !('matchMedia' in window) || !window.matchMedia) {
    return 'dark';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'system';
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // Gracefully handle privacy modes / restricted storage
  }

  return 'system';
}

export function applyThemeToDom(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;

  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');

  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', resolved === 'dark' ? '#020617' : '#ffffff');
  }
}

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme,
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<ThemeMode>(() => {
    if (defaultTheme) {
      return defaultTheme;
    }

    return getStoredTheme();
  });

  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>(() => {
    const initialTheme = defaultTheme ?? getStoredTheme();

    if (initialTheme === 'system') {
      return getSystemResolvedTheme();
    }

    return initialTheme;
  });

  // Keep DOM and meta synchronized whenever theme or system preference changes
  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (theme === 'system') {
      const currentResolved = getSystemResolvedTheme();
      setResolvedTheme(currentResolved);
      applyThemeToDom(currentResolved);

      if ('matchMedia' in window && window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = (e: MediaQueryListEvent) => {
          const next = e.matches ? 'dark' : 'light';
          setResolvedTheme(next);
          applyThemeToDom(next);
        };

        mediaQuery.addEventListener('change', handleChange);

        return () => mediaQuery.removeEventListener('change', handleChange);
      }
    } else {
      setResolvedTheme(theme);
      applyThemeToDom(theme);
    }
  }, [theme]);

  const setTheme = React.useCallback(
    (newTheme: ThemeMode) => {
      setThemeState(newTheme);

      try {
        window.localStorage.setItem(storageKey, newTheme);
      } catch {
        // Ignore storage errors in restricted iframe/private mode
      }

      const nextResolved = newTheme === 'system' ? getSystemResolvedTheme() : newTheme;
      setResolvedTheme(nextResolved);
      applyThemeToDom(nextResolved);
    },
    [storageKey],
  );

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);

  if (!context) {
    // Safe fallback if used outside ThemeProvider
    return {
      theme: 'system',
      resolvedTheme: getSystemResolvedTheme(),
      setTheme: () => {},
    };
  }

  return context;
}
