import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, ColorSchemeName } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Theme = 'system' | 'light' | 'dark';

interface ThemeState {
    theme: Theme;
    systemColorScheme: ColorSchemeName;
}

interface ThemeActions {
    setTheme: (theme: Theme) => void;
    setSystemColorScheme: (colorScheme: ColorSchemeName) => void;
    getEffectiveColorScheme: () => 'light' | 'dark';
}

export type ThemeStore = ThemeState & ThemeActions;

export const useThemeStore = create<ThemeStore>()(
    persist(
        (set, get) => ({
            theme: 'system',
            systemColorScheme: Appearance.getColorScheme(),

            setTheme: (theme) => {
                set({ theme });
            },

            setSystemColorScheme: (colorScheme) => {
                set({ systemColorScheme: colorScheme });
            },

            getEffectiveColorScheme: () => {
                const state = get();
                if (state.theme === 'system') {
                    return state.systemColorScheme === 'dark' ? 'dark' : 'light';
                }
                return state.theme;
            },
        }),
        {
            name: 'readspace-theme',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                theme: state.theme,
            }),
        }
    )
);
