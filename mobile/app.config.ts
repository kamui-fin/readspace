import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
	name: "readspace",
	slug: "readspace",
	version: "1.0.0",
	orientation: "portrait",
	icon: "./assets/images/icon.png",
	scheme: "readspace",
	userInterfaceStyle: "automatic",
	newArchEnabled: true,
	splash: {
		image: "./assets/images/splash-icon.png",
		resizeMode: "contain",
		backgroundColor: "#ffffff",
	},
	ios: {
		supportsTablet: false,
		bundleIdentifier: "com.readspace.app",
	},
	android: {
		adaptiveIcon: {
			foregroundImage: "./assets/images/adaptive-icon.png",
			backgroundColor: "#ffffff",
		},
		edgeToEdgeEnabled: true,
		package: "com.readspace.app",
	},
	web: {
		bundler: "metro",
		output: "static",
		favicon: "./assets/images/favicon.png",
	},
	plugins: [
		"expo-router",
		"expo-secure-store",
		[
			"expo-font",
			{
				fonts: [
					"node_modules/@expo-google-fonts/geist/400Regular/Geist_400Regular.ttf",
					"node_modules/@expo-google-fonts/geist/500Medium/Geist_500Medium.ttf",
					"node_modules/@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf",
					"node_modules/@expo-google-fonts/geist/700Bold/Geist_700Bold.ttf",
				],
			},
		],
	],
	experiments: {
		typedRoutes: true,
		buildCacheProvider: "eas",
	},
};

export default config;
