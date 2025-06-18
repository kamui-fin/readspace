import React from "react";
import { StyleSheet, View, Text, Button } from "react-native";
import { useAuth } from "@/src/context/user-context";
import { TYPOGRAPHY, COLORS } from "@lib/constants";

export default function ProfileScreen() {
	const { signOut, user } = useAuth();

	return (
		<View style={[styles.container]}>
			<View style={styles.content}>
				<Text style={styles.subtitle}>Welcome, {user?.email}</Text>
				<Button title="Sign Out" onPress={signOut} />
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
	subtitle: {
		...TYPOGRAPHY.STYLES.bodyLarge,
		color: COLORS.light.foreground,
		marginBottom: 16,
	},
	userInfo: {
		gap: 16,
	},
	signOutButton: {
		marginTop: "auto",
		marginBottom: 40,
	},
});
