import { CLOUD_CONFIG } from '@lib/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Cloud default configuration (hardcoded to always use production cloud instance)
const CLOUD_SETTINGS = {
  readspace_url: CLOUD_CONFIG.READSPACE_URL,
  supabase_url: CLOUD_CONFIG.SUPABASE_URL,
  supabase_anon_key: CLOUD_CONFIG.SUPABASE_ANON_KEY,
  meilisearch_url: CLOUD_CONFIG.MEILISEARCH_URL,
  meilisearch_search_key: CLOUD_CONFIG.MEILISEARCH_SEARCH_KEY,
};

export interface AppSettings {
  instance_type: 'cloud' | 'self-hosted';
  readspace_url: string;
  supabase_url: string;
  supabase_anon_key: string;
  meilisearch_url?: string;
  meilisearch_search_key?: string;
}

interface SettingsState {
  settings: AppSettings;
  // Whether the store has been rehydrated from AsyncStorage
  _hasHydrated: boolean;
}

interface SettingsActions {
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  resetToCloud: () => void;
  setSelfHosted: (config: {
    apiUrl: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
    meilisearchUrl?: string;
    meilisearchSearchKey?: string;
  }) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export type SettingsStore = SettingsState & SettingsActions;

const initialSettings: AppSettings = {
  instance_type: 'cloud',
  ...CLOUD_SETTINGS,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: initialSettings,
      _hasHydrated: false,

      setHasHydrated: (hasHydrated) => {
        set({ _hasHydrated: hasHydrated });
      },

      updateSettings: (newSettings) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ...newSettings,
          },
        }));
      },

      resetToCloud: () => {
        set({
          settings: {
            instance_type: 'cloud',
            ...CLOUD_SETTINGS,
          },
        });
      },

      setSelfHosted: (config) => {
        set({
          settings: {
            instance_type: 'self-hosted',
            readspace_url: config.apiUrl,
            supabase_url: config.supabaseUrl,
            supabase_anon_key: config.supabaseAnonKey,
            meilisearch_url: config.meilisearchUrl,
            meilisearch_search_key: config.meilisearchSearchKey,
          },
        });
      },
    }),
    {
      name: 'readspace-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        settings: state.settings,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Hook to check if the settings store has been hydrated from AsyncStorage
export const useHasSettingsHydrated = () => useSettingsStore((state) => state._hasHydrated);

// Helper function to get current settings synchronously
export const getSettings = () => useSettingsStore.getState().settings;
