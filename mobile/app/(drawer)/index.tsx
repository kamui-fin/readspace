import { View, Text } from "react-native";
import { router } from "expo-router";
import { TabBarIcon } from "@/components/router/TabBarIcon";
import { Button } from "@/components/ui/Button";

export default function DrawerIndex() {
	return (
		<View className="flex-1 p-4">
			<Text className="text-2xl font-bold mb-2">Drawer Content</Text>
			<Text className="text-base text-gray-500 mb-6">
				This is content in your drawer navigation
			</Text>

			<View className="mt-4 space-y-2">
				<Button
					variant="ghost"
					className="flex-row justify-start p-3"
					onPress={() => router.push("/(drawer)/settings")}
				>
					<View className="flex-row items-center">
						<TabBarIcon name="lucide:settings" color="#000" size={24} />
						<Text className="ml-3 text-base">Settings</Text>
					</View>
				</Button>

				<Button
					variant="ghost"
					className="flex-row justify-start p-3"
					onPress={() => router.push("/(tabs)")}
				>
					<View className="flex-row items-center">
						<TabBarIcon name="lucide:home" color="#000" size={24} />
						<Text className="ml-3 text-base">Back to Home</Text>
					</View>
				</Button>
			</View>
		</View>
	);
}
