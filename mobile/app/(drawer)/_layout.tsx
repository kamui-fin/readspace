import { Drawer } from "expo-router/drawer";
import {
	DrawerContentScrollView,
	DrawerItemList,
	DrawerItem,
} from "@react-navigation/drawer";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { useRouter } from "expo-router";
import { DrawerActions } from "@react-navigation/native";
import { COLORS } from "@/constants/Colors";
import Monicon from "@monicon/native";

function CustomDrawerContent(props: DrawerContentComponentProps) {
	const router = useRouter();

	return (
		<DrawerContentScrollView {...props}>
			<DrawerItemList {...props} />
			<DrawerItem
				label="Settings"
				labelStyle={{ fontSize: 16 }}
				icon={() => (
					<Monicon
						name="lucide:settings"
						size={24}
						color={COLORS.light.grey2}
					/>
				)}
				inactiveBackgroundColor={COLORS.light.root}
				activeBackgroundColor={COLORS.light.primary}
				onPress={() => {
					// Then navigate to the modal
					router.push("/(modal)/settings");
				}}
			/>
		</DrawerContentScrollView>
	);
}

export default function DrawerLayout() {
	return (
		<Drawer drawerContent={(props) => <CustomDrawerContent {...props} />}>
			<Drawer.Screen
				name="(tabs)"
				options={{
					drawerItemStyle: { display: "none" },
					headerShown: false,
				}}
			/>
		</Drawer>
	);
}
