import { Stack } from "expo-router";

export default function DrawerLayout() {
	return (
		<Stack>
			<Stack.Screen
				name="index"
				options={{
					title: "Drawer Content",
					headerShadowVisible: false,
				}}
			/>
			<Stack.Screen
				name="settings"
				options={{
					title: "Settings",
					headerShadowVisible: false,
				}}
			/>
		</Stack>
	);
}
