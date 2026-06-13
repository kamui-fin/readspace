import { supabase } from '@lib/supabase/client';
import { resolveHostname } from '@lib/utils/network';
import { ApiClient } from '@readspace/shared';
import { getSettings, useSettingsStore } from '@stores/settings';
import { Platform } from 'react-native';

/**
 * Configure the API client with the current settings from the store.
 * This function should be called:
 * - On app startup (after store rehydration)
 * - When settings are updated (instance switch)
 * - After login/logout
 */
export function configureApiClient(readspaceUrl?: string) {
  const settings = getSettings();
  const apiBaseUrl = resolveHostname(
    readspaceUrl || settings?.readspace_url || 'http://localhost:8008'
  );

  console.log('[API] Configuring with baseUrl:', apiBaseUrl);

  ApiClient.configure({
    baseUrl: apiBaseUrl,
    getAuthToken: async () => {
      if (!supabase) {
        console.warn('[API] No Supabase client available');
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
          console.log('[API] Token expiring soon, refreshing...');
          const {
            data: { session: refreshedSession },
            error,
          } = await supabase.auth.refreshSession();

          if (error) {
            console.error('[API] Failed to refresh session:', error);
            return session.access_token; // Return old token as fallback
          }

          if (refreshedSession) {
            console.log('[API] Session refreshed successfully');
            return refreshedSession.access_token;
          }
        }
      }

      return session.access_token;
    },
  });
}

// Listen for settings changes to reconfigure client
if (typeof useSettingsStore !== 'undefined') {
  useSettingsStore.subscribe((state) => {
    configureApiClient(state.settings.readspace_url);
  });
}

