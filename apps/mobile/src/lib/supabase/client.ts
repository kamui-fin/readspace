import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Create an adapter for expo-secure-store that implements AsyncStorage interface
const SecureStoreAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        try {
            return await SecureStore.getItemAsync(key);
        } catch (error) {
            console.error(`Error getting item ${key} from SecureStore:`, error);
            return null;
        }
    },
    setItem: async (key: string, value: string): Promise<void> => {
        try {
            await SecureStore.setItemAsync(key, value);
        } catch (error) {
            console.error(`Error setting item ${key} in SecureStore:`, error);
            throw error;
        }
    },
    removeItem: async (key: string): Promise<void> => {
        try {
            await SecureStore.deleteItemAsync(key);
        } catch (error) {
            console.error(`Error removing item ${key} from SecureStore:`, error);
            throw error;
        }
    },
};

// Helper to resolve hostname for Android emulator
const resolveHostname = (url: string | undefined) => {
    if (!url) return undefined;
    const _url = new URL(url);
    if (_url.hostname === 'localhost' && Platform.OS === 'android') {
        _url.hostname = '10.0.2.2';
    }
    return _url.toString();
};

const supabaseUrl = resolveHostname(process.env.EXPO_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('Supabase config check:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'undefined',
    key: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'undefined',
});

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables!');
    console.error('EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl);
    console.error('EXPO_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey);
    throw new Error(
        'Missing required Supabase environment variables. Please check your .env file.'
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: SecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

console.log('Supabase client initialized successfully');

// Auto-refresh session when app becomes active
AppState.addEventListener('change', (state) => {
    if (state === 'active') {
        supabase.auth.startAutoRefresh();
    } else {
        supabase.auth.stopAutoRefresh();
    }
});
