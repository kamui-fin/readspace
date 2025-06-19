import { Platform } from "react-native";

const IOS_SYSTEM_COLORS = {
	white: "rgb(255, 255, 255)",
	black: "rgb(0, 0, 0)",
	light: {
		grey6: "rgb(247, 247, 247)",
		grey5: "rgb(237, 237, 237)",
		grey4: "rgb(226, 227, 227)",
		grey3: "rgb(211, 212, 211)",
		grey2: "rgb(180, 182, 180)",
		grey: "rgb(159, 162, 160)",
		background: "rgb(255, 255, 255)",
		screen_background: "rgb(255, 255, 255)",
		foreground: "rgb(5, 6, 5)",
		root: "rgb(245, 246, 245)",
		card: "rgb(245, 246, 245)",
		destructive: "rgb(255, 56, 43)",
		primary: "rgb(56, 102, 65)",
		unified_bg: "#F5F5F5",
		tab_border: "#E0E0E0",
		active_tint: "black",
		inactive_tint: "grey",
		tab_bar_overlay: "rgba(255, 255, 255, 0.8)",
		tab_bar_background_ios: "rgba(255, 255, 255, 0.8)",
		tab_bar_background_default: "rgba(255, 255, 255, 1)",
	},
	dark: {
		grey6: "rgb(27, 28, 27)",
		grey5: "rgb(45, 47, 46)",
		grey4: "rgb(58, 60, 58)",
		grey3: "rgb(78, 80, 78)",
		grey2: "rgb(121, 124, 121)",
		grey: "rgb(159, 162, 160)",
		background: "rgb(2, 4, 2)",
		screen_background: "rgb(27, 28, 27)",
		foreground: "rgb(248, 251, 249)",
		root: "rgb(2, 4, 2)",
		card: "rgb(2, 4, 2)",
		destructive: "rgb(254, 67, 54)",
		primary: "rgb(89, 162, 103)",
		unified_bg: "#121212",
		tab_border: "#2A2A2A",
		active_tint: "#E5E5E5",
		inactive_tint: "#888888",
		tab_bar_overlay: "rgba(0, 0, 0, 0.1)",
		tab_bar_background_ios: "rgba(0, 0, 0, 0.1)",
		tab_bar_background_default: "rgba(0, 0, 0, 1)",
	},
} as const;

const ANDROID_COLORS = {
	white: "rgb(255, 255, 255)",
	black: "rgb(0, 0, 0)",
	light: {
		grey6: "rgb(250, 252, 255)",
		grey5: "rgb(243, 247, 251)",
		grey4: "rgb(236, 242, 248)",
		grey3: "rgb(233, 239, 247)",
		grey2: "rgb(229, 237, 245)",
		grey: "rgb(226, 234, 243)",
		background: "rgb(250, 252, 255)",
		foreground: "rgb(27, 28, 29)",
		root: "rgb(250, 252, 255)",
		card: "rgb(250, 252, 255)",
		destructive: "rgb(186, 26, 26)",
		primary: "rgb(0, 112, 233)",
		unified_bg: "#F5F5F5",
		tab_border: "#E0E0E0",
		active_tint: "black",
		inactive_tint: "grey",
		tab_bar_overlay: "rgba(255, 255, 255, 0.8)",
		tab_bar_background_ios: "rgba(255, 255, 255, 0.8)",
		tab_bar_background_default: "rgba(255, 255, 255, 1)",
	},
	dark: {
		grey6: "rgb(25, 30, 36)",
		grey5: "rgb(31, 38, 45)",
		grey4: "rgb(35, 43, 52)",
		grey3: "rgb(38, 48, 59)",
		grey2: "rgb(40, 51, 62)",
		grey: "rgb(44, 56, 68)",
		background: "rgb(24, 28, 32)",
		foreground: "rgb(221, 227, 233)",
		root: "rgb(24, 28, 32)",
		card: "rgb(24, 28, 32)",
		destructive: "rgb(147, 0, 10)",
		primary: "rgb(0, 69, 148)",
		unified_bg: "#121212",
		tab_border: "#2A2A2A",
		active_tint: "#E5E5E5",
		inactive_tint: "#888888",
		tab_bar_overlay: "rgba(0, 0, 0, 0.1)",
		tab_bar_background_ios: "rgba(0, 0, 0, 0.1)",
		tab_bar_background_default: "rgba(0, 0, 0, 1)",
	},
} as const;

const WEB_COLORS = {
	white: "rgb(255, 255, 255)",
	black: "rgb(0, 0, 0)",
	light: {
		grey6: "rgb(250, 252, 255)",
		grey5: "rgb(243, 247, 251)",
		grey4: "rgb(236, 242, 248)",
		grey3: "rgb(233, 239, 247)",
		grey2: "rgb(229, 237, 245)",
		grey: "rgb(226, 234, 243)",
		background: "rgb(250, 252, 255)",
		foreground: "rgb(27, 28, 29)",
		root: "rgb(250, 252, 255)",
		card: "rgb(250, 252, 255)",
		destructive: "rgb(186, 26, 26)",
		primary: "rgb(0, 112, 233)",
		unified_bg: "#F5F5F5",
		tab_border: "#E0E0E0",
		active_tint: "black",
		inactive_tint: "grey",
		tab_bar_overlay: "rgba(255, 255, 255, 0.8)",
		tab_bar_background_ios: "rgba(255, 255, 255, 0.8)",
		tab_bar_background_default: "rgba(255, 255, 255, 1)",
	},
	dark: {
		grey6: "rgb(25, 30, 36)",
		grey5: "rgb(31, 38, 45)",
		grey4: "rgb(35, 43, 52)",
		grey3: "rgb(38, 48, 59)",
		grey2: "rgb(40, 51, 62)",
		grey: "rgb(44, 56, 68)",
		background: "rgb(24, 28, 32)",
		foreground: "rgb(221, 227, 233)",
		root: "rgb(24, 28, 32)",
		card: "rgb(24, 28, 32)",
		destructive: "rgb(147, 0, 10)",
		primary: "rgb(0, 69, 148)",
		unified_bg: "#121212",
		tab_border: "#2A2A2A",
		active_tint: "#E5E5E5",
		inactive_tint: "#888888",
		tab_bar_overlay: "rgba(0, 0, 0, 0.1)",
		tab_bar_background_ios: "rgba(0, 0, 0, 0.1)",
		tab_bar_background_default: "rgba(0, 0, 0, 1)",
	},
} as const;

export const COLORS =
	Platform.OS === "ios"
		? IOS_SYSTEM_COLORS
		: Platform.OS === "android"
			? ANDROID_COLORS
			: WEB_COLORS;

// Typography constants for consistent Geist font usage throughout the app
export const TYPOGRAPHY = {
	// Font families
	FONTS: {
		regular: "Geist_400Regular",
		medium: "Geist_500Medium",
		semibold: "Geist_600SemiBold",
		bold: "Geist_700Bold",
	},

	// Text styles for common use cases
	STYLES: {
		// Headers
		headerLarge: {
			fontFamily: "Geist_700Bold",
			fontSize: 28,
			fontWeight: "700" as const,
		},
		headerMedium: {
			fontFamily: "Geist_600SemiBold",
			fontSize: 24,
			fontWeight: "600" as const,
		},
		headerSmall: {
			fontFamily: "Geist_600SemiBold",
			fontSize: 20,
			fontWeight: "600" as const,
		},

		// Body text
		bodyLarge: {
			fontFamily: "Geist_500Medium",
			fontSize: 18,
			fontWeight: "500" as const,
		},
		bodyMedium: {
			fontFamily: "Geist_400Regular",
			fontSize: 16,
			fontWeight: "400" as const,
		},
		bodySmall: {
			fontFamily: "Geist_400Regular",
			fontSize: 14,
			fontWeight: "400" as const,
		},

		// Captions and labels
		caption: {
			fontFamily: "Geist_400Regular",
			fontSize: 12,
			fontWeight: "400" as const,
		},
		label: {
			fontFamily: "Geist_500Medium",
			fontSize: 14,
			fontWeight: "500" as const,
		},
	},
} as const;

export const BOTTOM_TABBAR_BASE_HEIGHT = 64;
