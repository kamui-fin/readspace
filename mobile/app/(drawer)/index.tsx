import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { TabBarIcon } from "@/components/router/TabBarIcon";

export default function DrawerIndex() {
	return (
		<View className="flex-1 p-4">
			<Text className="text-2xl font-bold mb-2">Drawer Content</Text>
			<Text className="text-base text-gray-500 mb-6">
				This is content in your drawer navigation
			</Text>

			<View className="mt-4">
				<Pressable
					className="flex-row items-center py-3 border-b border-gray-200"
					onPress={() => router.push("/(drawer)/settings")}
				>
					<TabBarIcon name="lucide:settings" color="#000" size={24} />
					<Text className="ml-3 text-base">Settings</Text>
				</Pressable>

				<Pressable
					className="flex-row items-center py-3 border-b border-gray-200"
					onPress={() => router.push("/(tabs)")}
				>
					<TabBarIcon name="lucide:home" color="#000" size={24} />
					<Text className="ml-3 text-base">Back to Home</Text>
				</Pressable>
			</View>
		</View>
	);
}
