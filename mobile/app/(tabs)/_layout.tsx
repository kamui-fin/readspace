import type React from "react";
import { Link, Tabs } from "expo-router";
import { Pressable, View, Text } from "react-native";

import Colors from "@constants/Colors";
import { useColorScheme } from "@hooks/useColorScheme";
import { useClientOnlyValue } from "@hooks/useClientOnlyValue";
import { TabBarIcon } from "@/components/router/TabBarIcon";

export default function TabLayout() {
	const colorScheme = useColorScheme();

	return (
		<Tabs
			screenOptions={{
				headerShadowVisible: false,
				tabBarStyle: {
					borderTopWidth: 0,
				},
				tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
				headerShown: useClientOnlyValue(false, true),
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
											color={Colors[colorScheme ?? "light"].text}
											size={25}
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
			<Tabs.Screen
				name="three"
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
											color={Colors[colorScheme ?? "light"].text}
											size={25}
										/>
									</View>
								)}
							</Pressable>
						</Link>
					),
				}}
			/>
			<Tabs.Screen
				name="four"
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
