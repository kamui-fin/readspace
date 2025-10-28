import { ApiClient } from '@readspace/shared';
import { Platform } from 'react-native';

// Helper to resolve hostname for Android emulator
const resolveHostname = (url: string) => {
    const _url = new URL(url);
    if (_url.hostname === 'localhost' && Platform.OS === 'android') {
        _url.hostname = '10.0.2.2';
    }
    // Remove trailing slash to prevent double slashes in API paths
    return _url.toString().replace(/\/$/, '');
};

/**
 * Configure the API client with the current settings from the store.
 * This function should be called:
 * - On app startup (after store rehydration)
 * - When settings are updated (instance switch)
 * - After login/logout
 */
export function configureApiClient(readspaceUrl?: string) {
    // Lazy import to avoid circular dependency
    const { getSettings } = require('@/stores/settings');
    const { getSupabaseClient } = require('../supabase/client');

    const settings = getSettings();
    const apiBaseUrl = resolveHostname(readspaceUrl || settings.readspace_url);

    console.log('[ApiClient] Configuring with baseUrl:', apiBaseUrl);

    ApiClient.configure({
        baseUrl: apiBaseUrl,
        getAuthToken: async () => {
            const supabase = getSupabaseClient();
            if (!supabase) {
                console.warn('[ApiClient] No Supabase client available');
                return null;
            }

            const {
                data: { session },
            } = await supabase.auth.getSession();
            return session?.access_token ?? null;
        },
    });
}
