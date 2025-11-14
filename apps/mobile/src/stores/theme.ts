import { Appearance, type ColorSchemeName } from 'react-native';
import { colorScheme } from 'nativewind';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({
  id: 'theme-storage',
});

// MMKV storage adapter for Zustand
const mmkvStorage = {
  getItem: (name: string) => {
    const value = storage.getString(name);
    return value ?? null;
  },
  setItem: (name: string, value: string) => {
    storage.set(name, value);
  },
  removeItem: (name: string) => {
    storage.delete(name);
  },
};

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
      storage: createJSONStorage(() => mmkvStorage),
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
