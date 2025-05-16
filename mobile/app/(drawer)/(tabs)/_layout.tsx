import type React from "react";
import { Link, router, Tabs } from "expo-router";
import { Pressable, View } from "react-native";
import { Monicon } from "@monicon/native";
import { useNavigation, DrawerActions } from "@react-navigation/native";

import { COLORS } from "@constants/Colors";
import { useColorScheme } from "@hooks/useColorScheme";
import { useClientOnlyValue } from "@hooks/useClientOnlyValue";
import { TabBarIcon } from "@/components/router/TabBarIcon";

export default function TabLayout() {
	const colorScheme = useColorScheme();
	const navigation = useNavigation();

	return (
		<Tabs
			screenOptions={{
				headerShadowVisible: false,
				tabBarStyle: {
					borderTopWidth: 0,
				},
				tabBarActiveTintColor: COLORS[colorScheme ?? "light"].primary,
				headerShown: useClientOnlyValue(false, true),
				headerLeft: () => (
					<Pressable
						onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
						style={{ marginLeft: 12 }}
					>
						<Monicon
							name="lucide:menu"
							size={24}
							color={COLORS[colorScheme ?? "light"].foreground}
						/>
					</Pressable>
				),
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					tabBarLabel: () => null,
					tabBarIcon: ({ color }) => (
						<TabBarIcon
							name="lucide:badge-check"
							color={color}
							size={28}
							className="mb-1"
						/>
					),
					headerRight: () => (
						<Link href="/modal" asChild>
							<Pressable>
								{({ pressed }) => (
									<View style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}>
										<TabBarIcon
											name="lucide:info"
											color={COLORS[colorScheme ?? "light"].foreground}
											size={28}
										/>
									</View>
								)}
							</Pressable>
						</Link>
					),
				}}
			/>
			<Tabs.Screen
				name="two"
				options={{
					tabBarLabel: () => null,
					tabBarIcon: ({ color }) => (
						<TabBarIcon
							name="lucide:badge-check"
							color={color}
							size={28}
							className="mb-1"
						/>
					),
				}}
			/>
		</Tabs>
	);
}
