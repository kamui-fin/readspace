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
		package: "com.readspace.app",
		adaptiveIcon: {
			foregroundImage: "./assets/images/adaptive-icon.png",
			backgroundColor: "#ffffff",
		},
		edgeToEdgeEnabled: true,
	},
	web: {
		bundler: "metro",
		output: "static",
		favicon: "./assets/images/favicon.png",
	},
	plugins: ["expo-router"],
	experiments: {
		typedRoutes: true,
	},
	extra: {
		eas: {
			projectId: "c4419737-8659-4cef-9ca3-509396eaad44",
		},
	},
};

export default config;
