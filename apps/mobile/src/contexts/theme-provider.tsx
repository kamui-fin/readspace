import { useThemeStore } from '@stores/theme';
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { Uniwind } from 'uniwind';

/**
 * ThemeProvider sets up system theme listener and initializes theme store
 * Should be placed at the root of the app
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { setSystemColorScheme, setHydrated } = useThemeStore();

  useEffect(() => {
    // Set initial system color scheme
    const initialScheme = Appearance.getColorScheme();
    setSystemColorScheme(initialScheme);

    // Listen for system theme changes
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemColorScheme(colorScheme);
    });

    // Mark as hydrated after initial setup
    setHydrated();

    return () => {
      subscription.remove();
    };
  }, [setSystemColorScheme, setHydrated]);

  return <>{children}</>;
}


