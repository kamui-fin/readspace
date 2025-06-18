import {
	BlurView as RNBlurView,
	type BlurViewProps as RNBlurViewProps,
} from "@react-native-community/blur";
import type { JSX } from "react";
import { StyleSheet } from "react-native";

export type BlurViewProps = RNBlurViewProps & {
	tw?: string;
	children?: JSX.Element;
};

export const BlurView = ({ children, ...rest }: BlurViewProps) => {
	return (
		<RNBlurView
			style={StyleSheet.absoluteFillObject}
			blurAmount={100}
			{...rest}
		>
			{children}
		</RNBlurView>
	);
};
