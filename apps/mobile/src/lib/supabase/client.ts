import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';
import { resolveHostname } from '@lib/utils/network';
import { getSettings, useSettingsStore } from '@stores/settings';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Singleton Supabase client
let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create the Supabase client.
 * The client is created lazily based on current settings from the store.
 * If url and key are provided, they override the settings store (useful for validation).
 */
export function getSupabaseClient(supabaseUrl?: string, supabaseAnonKey?: string): SupabaseClient {
  // If client exists and no override params provided, return existing client
  if (supabaseClient && !supabaseUrl && !supabaseAnonKey) {
    return supabaseClient;
  }

  // Get settings from store if not provided
  const settings = getSettings();
  const url = supabaseUrl || settings.supabase_url;
  const key = supabaseAnonKey || settings.supabase_anon_key;

  if (!url || !key) {
    throw new Error('Missing Supabase configuration. Please configure your instance settings.');
  }

  const resolvedUrl = resolveHostname(url);

  console.log('[Supabase] Creating client with URL:', resolvedUrl);
  console.log('[Supabase] Platform:', Platform.OS);
  console.log('[Supabase] Using anon key:', key.substring(0, 50) + '...');

  // Create new client (or override existing one if params provided)
  const client = createClient(resolvedUrl, key, {
    auth: {
      storage: AsyncStorage as any,
      autoRefreshToken: !supabaseUrl, // Don't auto-refresh for validation clients
      persistSession: !supabaseUrl, // Don't persist for validation clients
      detectSessionInUrl: false,
      // Use instance-specific storage key to prevent session leakage
      storageKey: supabaseUrl
        ? 'supabase-auth-validation'
        : `supabase-auth-${settings.instance_type}`,
    },
  });

  // Only set as singleton if using settings (not overriding)
  if (!supabaseUrl && !supabaseAnonKey) {
    supabaseClient = client;
  }

  return client;
}

/**
 * Reset the Supabase client singleton.
 * This should be called when switching instances to force recreation with new settings.
 * Note: This will invalidate any active subscriptions!
 */
export function resetSupabaseClient() {
  console.log('[Supabase] Resetting client (this will invalidate subscriptions)');
  if (supabaseClient) {
    supabaseClient = null;
  }
}

/**
 * Validate Supabase connection with given credentials.
 * Returns true if connection is successful, false otherwise.
 */
export async function validateSupabaseConnection(
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    console.log('[Supabase] Starting validation for URL:', supabaseUrl);
    const testClient = getSupabaseClient(supabaseUrl, supabaseAnonKey);

    console.log('[Supabase] Test client created, calling getSession...');
    // Test connection with a simple query
    const { data, error } = await testClient.auth.getSession();

    console.log('[Supabase] getSession response:', { hasData: !!data, error: error?.message });

    if (error) {
      console.log('[Supabase] Validation failed with error:', error);
      return { valid: false, error: error.message };
    }

    console.log('[Supabase] Validation successful');
    return { valid: true };
  } catch (error) {
    console.log('[Supabase] Validation caught exception:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

// Auto-refresh session when app becomes active
AppState.addEventListener('change', (state) => {
  const client = supabaseClient;
  if (!client) return;

  if (state === 'active') {
    client.auth.startAutoRefresh();
  } else {
    client.auth.stopAutoRefresh();
  }
});

// Reset the Supabase client when settings change
if (typeof useSettingsStore !== 'undefined') {
  useSettingsStore.subscribe(() => {
    resetSupabaseClient();
  });
}

// Backward compatibility export as a Proxy to dynamically refer to the active client
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop, receiver) {
    const client = getSupabaseClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

