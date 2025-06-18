import React, { FC } from "react";
import { useWindowDimensions, StyleSheet } from "react-native";
import Animated, {
	interpolate,
	SharedValue,
	useAnimatedStyle,
} from "react-native-reanimated";
import { COLORS } from "@lib/constants";

type Props = {
	indexDecimal: SharedValue<number>;
	numberOfTabs: number;
	tabsHorizontalPadding: number;
};

export const TabIndicator: FC<Props> = ({
	indexDecimal,
	numberOfTabs,
	tabsHorizontalPadding,
}) => {
	const { width } = useWindowDimensions();

	const tabBarItemWidth = (width - tabsHorizontalPadding * 2) / numberOfTabs;

	const rIndicatorStyle = useAnimatedStyle(() => {
		const translateX = interpolate(
			indexDecimal.value,
			[0, 1],
			[0, tabBarItemWidth],
		);

		return {
			width: tabBarItemWidth,
			transform: [{ translateX: translateX + tabsHorizontalPadding }],
		};
	});

	return <Animated.View style={[styles.indicator, rIndicatorStyle]} />;
};

const styles = StyleSheet.create({
	indicator: {
		height: 2,
		backgroundColor: COLORS.light.foreground,
	},
});
