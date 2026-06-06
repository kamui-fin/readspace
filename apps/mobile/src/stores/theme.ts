import { Appearance, type ColorSchemeName } from 'react-native';
import 'expo-sqlite/localStorage/install';
import { Uniwind } from 'uniwind';
// @ts-expect-error
import { UniwindStore } from 'uniwind/src/core/native/store';
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

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'system',
      systemColorScheme: Appearance.getColorScheme(),
      isHydrated: false,

      setTheme: (theme) => {
        // Clear style cache synchronously before render phase to prevent dirty cache hits
        try {
          if (UniwindStore && UniwindStore.cache) {
            UniwindStore.cache.clear();
          }
        } catch (e) {
          console.warn('Uniwind cache clear failed', e);
        }
        set({ theme });
        Uniwind.setTheme(theme);
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

      setHydrated: () => {
        set({ isHydrated: true });
      },
    }),
    {
      name: 'readspace-theme',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Clear cache on hydration
          try {
            if (UniwindStore && UniwindStore.cache) {
              UniwindStore.cache.clear();
            }
          } catch (e) {}
          state.setHydrated();
          Uniwind.setTheme(state.theme);
        }
      },
    }
  )
);
