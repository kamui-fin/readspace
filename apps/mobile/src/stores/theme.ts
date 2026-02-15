import { Appearance, type ColorSchemeName } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
    storage.remove(name);
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

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'system',
      systemColorScheme: Appearance.getColorScheme(),
      isHydrated: false,

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
          state.setHydrated();
        }
      },
    }
  )
);
