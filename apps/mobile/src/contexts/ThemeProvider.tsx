import { useThemeStore } from '@/stores/theme';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { Appearance } from 'react-native';

/**
 * ThemeProvider component that handles:
 * - System theme detection via React Native Appearance API
 * - Theme persistence via AsyncStorage (through zustand store)
 * - Applying theme to NativeWind's colorScheme
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { theme, systemColorScheme, setSystemColorScheme, isHydrated } = useThemeStore();
    const { setColorScheme } = useColorScheme();

    // Listen to system theme changes
    useEffect(() => {
        const subscription = Appearance.addChangeListener(({ colorScheme }) => {
            setSystemColorScheme(colorScheme);
        });

        return () => subscription.remove();
    }, [setSystemColorScheme]);

    // Apply effective color scheme to NativeWind whenever theme or system theme changes
    useEffect(() => {
        // Calculate effective scheme directly here to ensure reactivity
        const effectiveScheme =
            theme === 'system' ? (systemColorScheme === 'dark' ? 'dark' : 'light') : theme;

        console.log('[ThemeProvider] Applying theme:', {
            userTheme: theme,
            systemScheme: systemColorScheme,
            effectiveScheme,
            isHydrated,
        });

        setColorScheme(effectiveScheme);
    }, [theme, systemColorScheme, setColorScheme, isHydrated]);

    return <>{children}</>;
}
