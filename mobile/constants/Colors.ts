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
		background: "rgb(245, 246, 245)",
		foreground: "rgb(5, 6, 5)",
		root: "rgb(245, 246, 245)",
		card: "rgb(245, 246, 245)",
		destructive: "rgb(255, 56, 43)",
		primary: "rgb(56, 102, 65)",
	},
	dark: {
		grey6: "rgb(27, 28, 27)",
		grey5: "rgb(45, 47, 46)",
		grey4: "rgb(58, 60, 58)",
		grey3: "rgb(78, 80, 78)",
		grey2: "rgb(121, 124, 121)",
		grey: "rgb(159, 162, 160)",
		background: "rgb(2, 4, 2)",
		foreground: "rgb(248, 251, 249)",
		root: "rgb(2, 4, 2)",
		card: "rgb(2, 4, 2)",
		destructive: "rgb(254, 67, 54)",
		primary: "rgb(89, 162, 103)",
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
	},
} as const;

const COLORS =
	Platform.OS === "ios"
		? IOS_SYSTEM_COLORS
		: Platform.OS === "android"
			? ANDROID_COLORS
			: WEB_COLORS;

export { COLORS };
