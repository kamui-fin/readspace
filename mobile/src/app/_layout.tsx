import React from "react";
import {
	Geist_400Regular,
	Geist_500Medium,
	Geist_600SemiBold,
	Geist_700Bold,
	useFonts,
} from "@expo-google-fonts/geist";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ColorSchemeProvider } from "@showtime-xyz/universal.color-scheme";
import { SafeAreaProvider } from "@showtime-xyz/universal.safe-area";
import { SnackbarProvider } from "@showtime-xyz/universal.snackbar";
import { useRouter, useSegments } from "expo-router";
import { AuthProvider } from "@components/contexts/AuthProvider";
import { useAuth } from "@context/user-context";

import "react-native-reanimated";
import "../globals.css";

export {
	// Catch any errors thrown by the Layout component.
	ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
	// Ensure that reloading on `/modal` keeps a back button present.
	initialRouteName: "(auth)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
	const [loaded, error] = useFonts({
		Geist_400Regular,
		Geist_500Medium,
		Geist_600SemiBold,
		Geist_700Bold,
	});

	// Expo Router uses Error Boundaries to catch errors in the navigation tree.
	useEffect(() => {
		if (error) throw error;
	}, [error]);

	useEffect(() => {
		if (loaded) {
			SplashScreen.hideAsync();
		}
	}, [loaded]);

	if (!loaded) {
		return null;
	}

	return (
		<GestureHandlerRootView style={{ flexGrow: 1 }}>
			<AuthProvider>
				<SafeAreaProvider>
					<ColorSchemeProvider>
						<SnackbarProvider>
							<StackLayout />
						</SnackbarProvider>
					</ColorSchemeProvider>
				</SafeAreaProvider>
			</AuthProvider>
		</GestureHandlerRootView>
	);
}

function StackLayout() {
	const { isAuthenticated, isLoading } = useAuth();
	const segments = useSegments();
	const router = useRouter();

	useEffect(() => {
		if (isLoading) return;

		const inAuthGroup = segments[0] === "(auth)";

		if (isAuthenticated && inAuthGroup) {
			router.replace("/feeds");
		} else if (!isAuthenticated && !inAuthGroup) {
			router.replace("/(auth)");
		}
	}, [isAuthenticated, isLoading, segments, router]);

	if (isLoading) {
		return null; // Or a loading spinner
	}

	return (
		<Stack>
			<Stack.Screen name="(auth)" options={{ headerShown: false }} />
			<Stack.Screen name="(protected)" options={{ headerShown: false }} />
			<Stack.Screen name="+not-found" />
		</Stack>
	);
}
