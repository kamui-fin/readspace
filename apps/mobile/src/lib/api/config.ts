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

            // Get the current session
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session) {
                return null;
            }

            // Check if token is expired or about to expire (within 60 seconds)
            const expiresAt = session.expires_at;
            if (expiresAt) {
                const now = Math.floor(Date.now() / 1000);
                const timeUntilExpiry = expiresAt - now;

                // If token expires in less than 60 seconds, refresh it
                if (timeUntilExpiry < 60) {
                    console.log('[ApiClient] Token expiring soon, refreshing...');
                    const {
                        data: { session: refreshedSession },
                        error,
                    } = await supabase.auth.refreshSession();

                    if (error) {
                        console.error('[ApiClient] Failed to refresh session:', error);
                        return session.access_token; // Return old token as fallback
                    }

                    if (refreshedSession) {
                        console.log('[ApiClient] Session refreshed successfully');
                        return refreshedSession.access_token;
                    }
                }
            }

            return session.access_token;
        },
    });
}
