import React, { FC } from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import Reanimated, {
	interpolateColor,
	SharedValue,
	useAnimatedStyle,
} from "react-native-reanimated";
import { COLORS, TYPOGRAPHY } from "@lib/constants";

type Props = {
	index: number;
	tabName: string;
	indexDecimal: SharedValue<number>;
	onPress: () => void;
};

export function TabItem({ index, tabName, indexDecimal, onPress }: Props) {
	const rTextStyle = useAnimatedStyle(() => {
		const color = interpolateColor(
			indexDecimal.value,
			[index - 1, index, index + 1],
			[COLORS.light.grey, COLORS.light.foreground, COLORS.light.grey],
		);
		return { color };
	});

	return (
		<TouchableOpacity
			activeOpacity={0.9}
			onPress={onPress}
			style={styles.container}
		>
			<Reanimated.Text style={[styles.text, rTextStyle]}>
				{tabName}
			</Reanimated.Text>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	text: {
		...TYPOGRAPHY.STYLES.headerSmall,
		textTransform: "none",
	},
});
