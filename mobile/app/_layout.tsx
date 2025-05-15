import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
	DarkTheme,
	DefaultTheme,
	ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Drawer } from "expo-router/drawer";
import { Stack, Tabs } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@hooks/useColorScheme";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export {
	// Catch any errors thrown by the Layout component.
	ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
	// Ensure that reloading on `/modal` keeps a back button present.
	initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
	const [loaded, error] = useFonts({
		SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
		...FontAwesome.font,
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

	return <RootLayoutNav />;
}

function RootLayoutNav() {
	const colorScheme = useColorScheme();

	return (
		<ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
			<GestureHandlerRootView style={{ flex: 1 }}>
				<Drawer
					screenOptions={{
						drawerType: "slide",
						drawerPosition: "left",
						headerShown: false,
					}}
				>
					<Drawer.Screen
						name="(tabs)"
						options={{
							drawerItemStyle: {
								display: "none",
							},
						}}
					/>
					<Drawer.Screen
						name="modal"
						options={{
							drawerItemStyle: {
								display: "none",
							},
						}}
					/>
					<Drawer.Screen
						name="+not-found"
						options={{
							drawerItemStyle: {
								display: "none",
							},
						}}
					/>
					{/* <Drawer.Screen
						name="settings"
						options={{
							drawerLabel: "Settings",
							title: "Settings",
						}}
					/> */}
				</Drawer>
			</GestureHandlerRootView>
		</ThemeProvider>
	);
}
