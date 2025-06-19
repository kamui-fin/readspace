import React from "react";
import { StyleSheet, View, Text } from "react-native";
import { TYPOGRAPHY } from "@lib/constants";

export default function SourcesScreen() {
	return (
		<View style={styles.container}>
			<View style={styles.content}>
				<Text style={styles.subtitle}>
					Manage your RSS feeds and content sources
				</Text>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#fff",
	},
	content: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 20,
	},
	title: {
		...TYPOGRAPHY.STYLES.headerMedium,
		color: "#000",
		marginBottom: 8,
	},
	subtitle: {
		...TYPOGRAPHY.STYLES.bodyMedium,
		color: "#666",
		textAlign: "center",
		lineHeight: 22,
	},
});
