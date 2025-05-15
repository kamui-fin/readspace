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

			<View className="space-y-4">
				<Button
					variant={notificationsEnabled ? "default" : "outline"}
					className="flex-row justify-between py-3"
					onPress={() => setNotificationsEnabled(!notificationsEnabled)}
				>
					<Text className={notificationsEnabled ? "text-white" : "text-black"}>
						Notifications
					</Text>
					<TabBarIcon
						name={notificationsEnabled ? "lucide:bell" : "lucide:bell-off"}
						color={notificationsEnabled ? "#fff" : "#000"}
						size={18}
					/>
				</Button>

				<Button
					variant={darkModeEnabled ? "default" : "outline"}
					className="flex-row justify-between py-3"
					onPress={() => setDarkModeEnabled(!darkModeEnabled)}
				>
					<Text className={darkModeEnabled ? "text-white" : "text-black"}>
						Dark Mode
					</Text>
					<TabBarIcon
						name={darkModeEnabled ? "lucide:moon" : "lucide:sun"}
						color={darkModeEnabled ? "#fff" : "#000"}
						size={18}
					/>
				</Button>

				<Button
					variant={syncEnabled ? "default" : "outline"}
					className="flex-row justify-between py-3"
					onPress={() => setSyncEnabled(!syncEnabled)}
				>
					<Text className={syncEnabled ? "text-white" : "text-black"}>
						Background Sync
					</Text>
					<TabBarIcon
						name={syncEnabled ? "lucide:refresh-cw" : "lucide:refresh-ccw"}
						color={syncEnabled ? "#fff" : "#000"}
						size={18}
					/>
				</Button>
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
