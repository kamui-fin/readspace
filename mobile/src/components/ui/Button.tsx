import React, { ReactNode } from "react";
import {
	Pressable,
	PressableProps,
	StyleSheet,
	StyleProp,
	TextStyle,
	ViewStyle,
} from "react-native";
import { Text } from "@components/Themed";
import { COLORS, TYPOGRAPHY } from "@lib/constants";

type ButtonSize = "small" | "medium" | "large";

interface ButtonProps extends Omit<PressableProps, "style"> {
	children: ReactNode;
	size?: ButtonSize;
	variant?: "primary" | "secondary" | "text" | "default";
	fullWidth?: boolean;
	leftIcon?: ReactNode;
	rightIcon?: ReactNode;
	style?: StyleProp<ViewStyle>;
	textStyle?: StyleProp<TextStyle>;
}

const BUTTON_HEIGHTS = {
	small: 52,
	medium: 60,
	large: 68,
} as const;

const BUTTON_PADDINGS = {
	small: 12,
	medium: 16,
	large: 20,
} as const;

const TEXT_STYLES = {
	small: TYPOGRAPHY.STYLES.bodySmall,
	medium: TYPOGRAPHY.STYLES.bodyMedium,
	large: TYPOGRAPHY.STYLES.bodyLarge,
} as const;

export function Button({
	children,
	size = "medium",
	variant = "default",
	fullWidth = true,
	leftIcon,
	rightIcon,
	style,
	textStyle,
	...props
}: ButtonProps) {
	const getBackgroundColor = () => {
		switch (variant) {
			case "primary":
				return COLORS.light.primary;
			case "secondary":
				return COLORS.light.grey5;
			case "text":
				return "transparent";
			case "default":
				return COLORS.black;
		}
	};

	const getTextColor = () => {
		switch (variant) {
			case "primary":
				return COLORS.white;
			case "text":
				return COLORS.light.grey;
			case "secondary":
				return COLORS.black;
			default:
				return COLORS.white;
		}
	};

	const getPadding = () => {
		if (variant === "text") return 0;
		return BUTTON_PADDINGS[size];
	};

	const getHeight = () => {
		if (variant === "text") return "auto";
		return BUTTON_HEIGHTS[size];
	};

	return (
		<Pressable
			style={[
				styles.base,
				{
					height: getHeight(),
					paddingHorizontal: getPadding(),
					backgroundColor: getBackgroundColor(),
					width: fullWidth && variant !== "text" ? "100%" : "auto",
				} as ViewStyle,
				variant === "text" && styles.textVariant,
				style,
			]}
			{...props}
		>
			{leftIcon && <>{leftIcon}</>}
			<Text
				style={[
					TEXT_STYLES[size],
					styles.text,
					{ color: getTextColor() } as TextStyle,
					textStyle,
				]}
			>
				{children}
			</Text>
			{rightIcon && <>{rightIcon}</>}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	base: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		borderRadius: 12,
		gap: 8,
	},
	text: {
		textAlign: "center",
	},
	textVariant: {
		backgroundColor: "transparent",
		minHeight: 44,
		paddingVertical: 8,
	},
});
