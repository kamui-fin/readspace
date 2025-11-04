import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Cloud default configuration
const CLOUD_CONFIG = {
    readspace_url: 'https://api.readspace.ai',
    supabase_url: 'https://hnqyngkyugiamvlhqoaf.supabase.co',
    supabase_anon_key:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhucXluZ2t5dWdpYW12bGhxb2FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzODIwNDMsImV4cCI6MjA2NTk1ODA0M30.iu6pCWAX5ofuSumz6V0VwKNSEh88XDJ2RCC_iTln0xs',
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
    setSelfHosted: (config: {
        apiUrl: string;
        supabaseUrl: string;
        supabaseAnonKey: string;
    }) => void;
}

export type SettingsStore = SettingsState & SettingsActions;

const initialSettings: AppSettings = {
    instance_type: 'cloud',
    ...CLOUD_CONFIG,
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
                        ...CLOUD_CONFIG,
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
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                settings: state.settings,
            }),
            onRehydrateStorage: () => (state) => {
                console.log('[SettingsStore] Rehydration started');
                if (state) {
                    console.log('[SettingsStore] Rehydrated settings:', {
                        instance_type: state.settings.instance_type,
                        readspace_url: state.settings.readspace_url,
                        supabase_url: state.settings.supabase_url,
                        supabase_anon_key:
                            state.settings.supabase_anon_key.substring(0, 50) + '...',
                    });

                    // Reconfigure clients with rehydrated settings (lazy import to avoid circular dependency)
                    const { resetSupabaseClient } = require('@/lib/supabase/client');
                    const { configureApiClient } = require('@/lib/api/config');

                    console.log('[SettingsStore] Resetting Supabase client after rehydration');
                    resetSupabaseClient();

                    console.log('[SettingsStore] Reconfiguring API client after rehydration');
                    configureApiClient();
                } else {
                    console.log('[SettingsStore] No state to rehydrate, using defaults');
                }
            },
        }
    )
);

// Helper function to get current settings synchronously
export const getSettings = (): AppSettings => {
    return useSettingsStore.getState().settings;
};
