import React from "react";
import { router } from "expo-router";
import { AppState, Pressable } from "react-native";
import { Text } from "@components/Themed";
import { View } from "@showtime-xyz/universal.view";
import { TextInput } from "@showtime-xyz/universal.text-input";
import { supabase } from "@lib/supabase/client";
import { useSafeAreaInsets } from "@showtime-xyz/universal.safe-area";
import { COLORS, TYPOGRAPHY } from "@/src/lib/constants";
import Monicon from "@monicon/native";

AppState.addEventListener("change", (state) => {
	if (state === "active") {
		supabase.auth.startAutoRefresh();
	} else {
		supabase.auth.stopAutoRefresh();
	}
});

export default function LoginScreen() {
	const insets = useSafeAreaInsets();
	const colors = COLORS.light;

	return (
		<View
			style={{
				paddingHorizontal: 28,
				paddingVertical: 10 * insets.bottom,
				backgroundColor: colors.background,
				justifyContent: "flex-start",
				flex: 1,
			}}
		>
			<View style={{ paddingVertical: 1.2 * insets.bottom }}>
				<Text style={{ ...TYPOGRAPHY.STYLES.headerSmall }}>Login</Text>
				<Text style={{ ...TYPOGRAPHY.STYLES.headerLarge }}>
					Jump back into personalized experiences
				</Text>
			</View>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					borderWidth: 2,
					borderColor: colors.grey3,
					borderRadius: 12,
					paddingHorizontal: 16,
					marginBottom: 16,
					backgroundColor: colors.grey5,
				}}
			>
				<Monicon name="lucide:mail" size={24} color={colors.grey} />
				<TextInput
					placeholder="Email"
					style={{
						flex: 1,
						padding: 16,
					}}
				/>
			</View>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					borderWidth: 2,
					borderColor: colors.grey3,
					borderRadius: 12,
					paddingHorizontal: 16,
					marginBottom: 0.96 * insets.bottom,
					backgroundColor: colors.grey5,
				}}
			>
				<Monicon name="lucide:lock" size={24} color={colors.grey} />
				<TextInput
					placeholder="Password"
					placeholderClassName="text-xl"
					style={{
						flex: 1,
						padding: 16,
					}}
				/>
			</View>
			<Pressable
				// onPress={() => router.push("/(protected)/(tabs)/feeds")}
				className="flex-row items-center justify-center rounded-xl py-6 w-full"
				style={{
					backgroundColor: colors.grey2,
				}}
			>
				<View style={{ position: "relative", alignItems: "center" }}>
					<Text
						style={{
							...TYPOGRAPHY.STYLES.bodyLarge,
							color: COLORS.white,
						}}
					>
						Continue
					</Text>
				</View>
			</Pressable>
		</View>
	);
}
