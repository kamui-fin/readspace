import { ApiClient } from '@readspace/shared';
import { Platform } from 'react-native';
import { supabase } from '../supabase/client';

// Helper to resolve hostname for Android emulator
const resolveHostname = (url: string | undefined) => {
    if (!url) return undefined;
    const _url = new URL(url);
    if (_url.hostname === 'localhost' && Platform.OS === 'android') {
        _url.hostname = '10.0.2.2';
    }
    // Remove trailing slash to prevent double slashes in API paths
    return _url.toString().replace(/\/$/, '');
};

const apiBaseUrl = resolveHostname(process.env.EXPO_PUBLIC_API_BASE_URL);

if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not defined in environment variables');
}

// Configure the ApiClient with Supabase auth token provider
ApiClient.configure({
    baseUrl: apiBaseUrl,
    getAuthToken: async () => {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        return session?.access_token ?? null;
    },
});

console.log('ApiClient configured with baseUrl:', apiBaseUrl);

// Export the configured ApiClient
export { ApiClient };
