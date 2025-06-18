import { AppState } from "react-native";
import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log("Supabase config check:", {
	hasUrl: !!supabaseUrl,
	hasKey: !!supabaseAnonKey,
	url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : "undefined",
	key: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : "undefined",
});

if (!supabaseUrl || !supabaseAnonKey) {
	console.error("Missing Supabase environment variables!");
	console.error("EXPO_PUBLIC_SUPABASE_URL:", supabaseUrl);
	console.error("EXPO_PUBLIC_SUPABASE_ANON_KEY:", supabaseAnonKey);
	throw new Error(
		"Missing required Supabase environment variables. Please check your .env file.",
	);
}

// Custom SecureStore adapter for Supabase
const ExpoSecureStoreAdapter = {
	getItem: (key: string) => {
		return SecureStore.getItemAsync(key);
	},
	setItem: (key: string, value: string) => {
		SecureStore.setItemAsync(key, value);
	},
	removeItem: (key: string) => {
		SecureStore.deleteItemAsync(key);
	},
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		storage: ExpoSecureStoreAdapter,
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false,
	},
});

console.log("Supabase client initialized successfully");

// Auto-refresh session when app becomes active
AppState.addEventListener("change", (state) => {
	if (state === "active") {
		supabase.auth.startAutoRefresh();
	} else {
		supabase.auth.stopAutoRefresh();
	}
});
