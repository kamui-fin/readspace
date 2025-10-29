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
    const { theme, systemColorScheme, setSystemColorScheme, getEffectiveColorScheme } =
        useThemeStore();
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
        const effectiveScheme = getEffectiveColorScheme();
        setColorScheme(effectiveScheme);
    }, [theme, systemColorScheme, getEffectiveColorScheme, setColorScheme]);

    return <>{children}</>;
}
