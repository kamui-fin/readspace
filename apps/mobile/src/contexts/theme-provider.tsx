import { useThemeStore } from '@stores/theme';
import { useEffect } from 'react';
import { Appearance } from 'react-native';

/**
 * ThemeProvider sets up system theme listener and initializes theme store
 * Should be placed at the root of the app
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { setSystemColorScheme, setHydrated } = useThemeStore();
  const theme = useThemeStore((state) => state.theme);
  const effectiveScheme = useThemeStore((state) => state.getEffectiveColorScheme());

  useEffect(() => {
    // Set initial system color scheme
    const initialScheme = Appearance.getColorScheme() ?? 'light';
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

  /**
   * Push the resolved theme down to UIKit / Android's night mode.
   *
   * Our own views read the store, but every *native* surface — the navigation bar and its
   * `UISearchController`, native menus, the tab bar, share sheets — reads the process-level
   * appearance instead. Without this they follow the phone while the app follows the store, so
   * choosing Dark on a light phone left the Discover search field with dark-on-dark text.
   *
   * On `system` the override is released so the phone is back in charge.
   */
  useEffect(() => {
    // `null` releases the override; RN's types omit it, but it is the documented reset value.
    Appearance.setColorScheme(
      (theme === 'system' ? null : effectiveScheme) as Parameters<
        typeof Appearance.setColorScheme
      >[0]
    );
  }, [theme, effectiveScheme]);

  return <>{children}</>;
}
