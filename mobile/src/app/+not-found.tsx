import React from "react";
import { Link, Stack } from "expo-router";
import { StyleSheet } from "react-native";

import { Text, View } from "@components/Themed";
import { TYPOGRAPHY } from "@lib/constants";
import { useAuth } from "../context/user-context";

export default function NotFoundScreen() {
	const { isAuthenticated } = useAuth();
	return (
		<>
			<Stack.Screen options={{ title: "Oops!" }} />
			<View style={styles.container}>
				<Text style={styles.title}>This screen doesn't exist.</Text>

				<Link href={isAuthenticated ? "/feeds" : "/"} style={styles.link}>
					<Text style={styles.linkText}>Go to home screen!</Text>
				</Link>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 20,
	},
	title: {
		...TYPOGRAPHY.STYLES.headerMedium,
	},
	link: {
		marginTop: 16,
		paddingVertical: 16,
	},
	linkText: {
		...TYPOGRAPHY.STYLES.bodyMedium,
	},
});
