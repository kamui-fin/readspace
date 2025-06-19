/**
 * Learn more about Light and Dark modes:
 * https://docs.expo.io/guides/color-schemes/
 */

import { Text as DefaultText, View as DefaultView } from "react-native";

import { COLORS } from "@/src/lib/constants";
import { useColorScheme } from "../hooks/useColorScheme";

type ThemeProps = {
	lightColor?: string;
	darkColor?: string;
};

export type TextProps = ThemeProps & DefaultText["props"];
export type ViewProps = ThemeProps & DefaultView["props"];

export function useThemeColor(
	props: { light?: string; dark?: string },
	colorName: keyof typeof COLORS.light & keyof typeof COLORS.dark,
) {
	const theme = useColorScheme() ?? "light";
	const colorFromProps = props[theme];

	if (colorFromProps) {
		return colorFromProps;
	}
	return COLORS[theme][colorName];
}

export function Text(props: TextProps) {
	const { style, lightColor, darkColor, ...otherProps } = props;
	const themeColor = useThemeColor(
		{ light: lightColor, dark: darkColor },
		"foreground",
	);

	// Flatten style array and check for color override
	const flattenedStyle = Array.isArray(style)
		? Object.assign({}, ...style)
		: style || {};
	const color = flattenedStyle.color || themeColor;

	return <DefaultText style={[{ color }, style]} {...otherProps} />;
}

export function View(props: ViewProps) {
	const { style, lightColor, darkColor, ...otherProps } = props;
	const backgroundColor = useThemeColor(
		{ light: lightColor, dark: darkColor },
		"background",
	);

	return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}
