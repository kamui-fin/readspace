import React from "react";
import { StyleSheet, View, Text } from "react-native";
import { COLORS, TYPOGRAPHY } from "@lib/constants";

export default function SavedScreen() {
	return (
		<View style={styles.container}>
			<View style={styles.content}>
				<Text style={styles.subtitle}>
					Your bookmarked articles will appear here
				</Text>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: COLORS.light.background,
	},
	content: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 20,
	},
	title: {
		...TYPOGRAPHY.STYLES.headerMedium,
		color: COLORS.light.foreground,
		marginBottom: 8,
	},
	subtitle: {
		...TYPOGRAPHY.STYLES.bodyMedium,
		color: COLORS.light.grey,
		textAlign: "center",
		lineHeight: 22,
	},
});
