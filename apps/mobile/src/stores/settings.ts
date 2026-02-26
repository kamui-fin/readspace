import { CLOUD_CONFIG } from '@lib/constants/config';
import 'expo-sqlite/localStorage/install';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Cloud default configuration (hardcoded to always use production cloud instance)
const CLOUD_SETTINGS = {
  readspace_url: CLOUD_CONFIG.READSPACE_URL,
  supabase_url: CLOUD_CONFIG.SUPABASE_URL,
  supabase_anon_key: CLOUD_CONFIG.SUPABASE_ANON_KEY,
};

export interface AppSettings {
  instance_type: 'cloud' | 'self-hosted';
  readspace_url: string;
  supabase_url: string;
  supabase_anon_key: string;
}

interface SettingsState {
  settings: AppSettings;
}

interface SettingsActions {
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  resetToCloud: () => void;
  setSelfHosted: (config: { apiUrl: string; supabaseUrl: string; supabaseAnonKey: string }) => void;
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
          },
        });
      },
    }),
    {
      name: 'readspace-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
);

// Helper function to get current settings synchronously
export const getSettings = () => useSettingsStore.getState().settings;
