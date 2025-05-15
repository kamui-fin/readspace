import { View, Text, Switch } from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { Button } from "@/components/ui/Button";
import { TabBarIcon } from "@/components/router/TabBarIcon";

export default function SettingsScreen() {
	const [notificationsEnabled, setNotificationsEnabled] = useState(true);
	const [darkModeEnabled, setDarkModeEnabled] = useState(false);
	const [syncEnabled, setSyncEnabled] = useState(true);

	return (
		<View className="flex-1 p-4">
			<Text className="text-2xl font-bold mb-6">Settings</Text>

			<View className="flex-row justify-between items-center py-3 border-b border-gray-200">
				<Text className="text-base">Notifications</Text>
				<Switch
					value={notificationsEnabled}
					onValueChange={setNotificationsEnabled}
				/>
			</View>

			<View className="flex-row justify-between items-center py-3 border-b border-gray-200">
				<Text className="text-base">Dark Mode</Text>
				<Switch value={darkModeEnabled} onValueChange={setDarkModeEnabled} />
			</View>

			<View className="flex-row justify-between items-center py-3 border-b border-gray-200">
				<Text className="text-base">Background Sync</Text>
				<Switch value={syncEnabled} onValueChange={setSyncEnabled} />
			</View>

			<View className="mt-auto items-center py-5">
				<Text className="text-sm text-gray-500">Version 1.0.0</Text>
				<Text className="text-xs text-gray-400 mt-1">© 2024 Readspace</Text>

				<Button
					variant="outline"
					className="mt-6"
					onPress={() => router.back()}
				>
					<View className="flex-row items-center">
						<TabBarIcon name="lucide:arrow-left" color="#000" size={18} />
						<Text className="ml-2">Back</Text>
					</View>
				</Button>
			</View>
		</View>
	);
}
