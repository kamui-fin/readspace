import { Tabs } from "expo-router";
import type React from "react";
import { View, Text } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";
import { BottomTabbar } from "@/src/components/navigation/bottom-tabs/CustomTabBar";
import { TabBarIcon } from "@/src/components/navigation/bottom-tabs/TabBarIcon";
import { Bookmark, Note, Search, Plus } from "@components/icons";
import ProfileAvatar from "@/src/components/ui/ProfileAvatar";
import { useClientOnlyValue } from "@hooks/useClientOnlyValue";
import { useColorScheme } from "@hooks/useColorScheme";
import { COLORS, TYPOGRAPHY } from "@lib/constants";
import { useAuth } from "@/src/context/user-context";
import { useNavigationElements } from "@hooks/useNavigationElements";

export default function TabLayout() {
	const colorScheme = useColorScheme();
	const plusButtonScale = useSharedValue(1);
	const { profile } = useAuth();

	const animatedPlusButtonStyle = useAnimatedStyle(() => {
		return {
			transform: [{ scale: plusButtonScale.value }],
		};
	});

	return (
		<Tabs
			tabBar={(props) => <BottomTabbar {...props} />}
			screenOptions={{
				headerStyle: {
					backgroundColor:
						COLORS[colorScheme ?? "light"].tab_bar_background_default,
				},
				headerTitleStyle: {
					...TYPOGRAPHY.STYLES.headerMedium,
					color: COLORS[colorScheme ?? "light"].foreground,
				},
				headerShadowVisible: false,
				headerShown: useClientOnlyValue(false, true),
			}}
			screenListeners={{
				state: (e) => {
					if (e.data.state.index === 2) {
						plusButtonScale.value = withSpring(1.1, {
							damping: 15,
							stiffness: 150,
						});
					} else {
						plusButtonScale.value = withSpring(1, {
							damping: 15,
							stiffness: 150,
						});
					}
				},
			}}
		>
			<Tabs.Screen
				name="feeds"
				options={{
					title: "Feeds",
					tabBarLabel: () => null,
					tabBarIcon: ({ color, focused }) => (
						<TabBarIcon
							component={Note}
							color={color}
							size={28}
							focused={focused}
							className="mb-1"
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="saved"
				options={{
					title: "Saved",
					tabBarLabel: () => null,
					tabBarIcon: ({ color, focused }) => (
						<TabBarIcon
							component={Bookmark}
							color={color}
							size={28}
							focused={focused}
							className="mb-1"
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="sources"
				options={{
					title: "Sources",
					tabBarIcon: ({ color, focused }) => (
						<Animated.View
							style={[
								{
									width: 64,
									height: 48,
									borderRadius: 16,
									backgroundColor: COLORS[colorScheme ?? "light"].grey5,
									alignItems: "center",
									justifyContent: "center",
								},
								animatedPlusButtonStyle,
							]}
						>
							<TabBarIcon
								component={Plus}
								color={
									focused
										? COLORS[colorScheme ?? "light"].foreground
										: COLORS[colorScheme ?? "light"].grey2
								}
								size={24}
							/>
						</Animated.View>
					),
				}}
			/>
			<Tabs.Screen
				name="search"
				options={{
					title: "Search",
					tabBarLabel: () => null,
					tabBarIcon: ({ color, focused }) => (
						<TabBarIcon
							component={Search}
							color={color}
							size={28}
							focused={focused}
							className="mb-1"
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="profile"
				options={{
					title: "Profile",
					tabBarLabel: () => null,
					tabBarIcon: () => <ProfileAvatar url={profile?.img_url} size={28} />,
				}}
			/>
		</Tabs>
	);
}
