import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, ColorSchemeName } from 'react-native';
import { colorScheme } from 'nativewind';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Theme = 'system' | 'light' | 'dark';

interface ThemeState {
    theme: Theme;
    systemColorScheme: ColorSchemeName;
    isHydrated: boolean;
}

interface ThemeActions {
    setTheme: (theme: Theme) => void;
    setSystemColorScheme: (colorScheme: ColorSchemeName) => void;
    getEffectiveColorScheme: () => 'light' | 'dark';
    setHydrated: () => void;
}

export type ThemeStore = ThemeState & ThemeActions;

// Helper to apply theme immediately
const applyTheme = (theme: Theme, systemColorScheme: ColorSchemeName) => {
    const effectiveScheme =
        theme === 'system' ? (systemColorScheme === 'dark' ? 'dark' : 'light') : theme;
    colorScheme.set(effectiveScheme);
};

export const useThemeStore = create<ThemeStore>()(
    persist(
        (set, get) => ({
            theme: 'system',
            systemColorScheme: Appearance.getColorScheme(),
            isHydrated: false,

            setTheme: (theme) => {
                set({ theme });
                applyTheme(theme, get().systemColorScheme);
            },

            setSystemColorScheme: (colorScheme) => {
                set({ systemColorScheme: colorScheme });
                applyTheme(get().theme, colorScheme);
            },

            getEffectiveColorScheme: () => {
                const state = get();
                if (state.theme === 'system') {
                    return state.systemColorScheme === 'dark' ? 'dark' : 'light';
                }
                return state.theme;
            },

            setHydrated: () => {
                set({ isHydrated: true });
            },
        }),
        {
            name: 'readspace-theme',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                theme: state.theme,
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    // Apply theme immediately after rehydration
                    applyTheme(state.theme, state.systemColorScheme);
                    state.setHydrated();
                }
            },
        }
    )
);
