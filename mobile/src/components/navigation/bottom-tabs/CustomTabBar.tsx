import { StyleSheet, Platform, useWindowDimensions } from "react-native";
import React from "react";
import Animated, {
	useSharedValue,
	useAnimatedStyle,
	withTiming,
} from "react-native-reanimated";

import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Link } from "expo-router";
import { Pressable } from "react-native-gesture-handler";

import { useSafeAreaInsets } from "@showtime-xyz/universal.safe-area";
import { View } from "@showtime-xyz/universal.view";

import { useBottomTabBarHeightCallback } from "@/src/hooks/useBottomTabBarHeightCallback";
import { BlurView } from "@lib/blurview";
import { BOTTOM_TABBAR_BASE_HEIGHT, COLORS } from "@lib/constants";
import { useColorScheme } from "@hooks/useColorScheme";
import { useNavigationElements } from "@hooks/useNavigationElements";
import { useIsDarkMode } from "@showtime-xyz/universal.hooks";

export const ThemeBottomTabbar = ({
	state,
	descriptors,
}: BottomTabBarProps) => {
	const colorScheme = useColorScheme();
	const currentColors = COLORS[colorScheme ?? "light"];
	const { width } = useWindowDimensions();

	const translateX = useSharedValue(
		(width / state.routes.length) * state.index,
	);

	React.useEffect(() => {
		translateX.value = withTiming((width / state.routes.length) * state.index, {
			duration: 250,
		});
	}, [state.index, width, state.routes.length, translateX]);

	const animatedStyle = useAnimatedStyle(() => {
		return {
			transform: [{ translateX: translateX.value }],
		};
	});

	return (
		<View
			style={{
				flexDirection: "row",
				backgroundColor: "transparent",
				paddingTop: 8,
			}}
		>
			{state.routes.map((route, index) => {
				const { options } = descriptors[route.key];
				const focused = state.index === index;
				const color = focused
					? currentColors.active_tint
					: currentColors.inactive_tint;

				return (
					<Link
						key={route.key}
						href={{
							pathname: route.name as any,
							params: route.params as any,
						}}
						asChild
					>
						<Pressable
							style={{
								flex: 1,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							{options.tabBarIcon?.({ focused, color, size: 24 })}
						</Pressable>
					</Link>
				);
			})}
			<Animated.View
				style={[
					{
						position: "absolute",
						top: 0,
						height: 2,
						backgroundColor:
							state.index === 2 ? "transparent" : currentColors.active_tint,
						width: width / state.routes.length,
					},
					animatedStyle,
				]}
			/>
		</View>
	);
};

export const BottomTabbar = (props: BottomTabBarProps) => {
	const { isTabBarHidden } = useNavigationElements();
	const { bottom: safeAreaBottom } = useSafeAreaInsets();
	const nativeBottomTabBarHeightCallback = useBottomTabBarHeightCallback();
	const isHiddenBottomTabbar = isTabBarHidden;
	const isDark = useIsDarkMode();
	const colorScheme = useColorScheme();

	const overlayColor = COLORS[colorScheme ?? "light"].tab_bar_overlay;
	const blurType = isDark ? "dark" : "light";

	if (isHiddenBottomTabbar) {
		return null;
	}

	return (
		<View
			style={{
				position: "absolute",
				bottom: 0,
				width: "100%",
				height: BOTTOM_TABBAR_BASE_HEIGHT + 0.8 * safeAreaBottom,
				overflow: "hidden",
				backgroundColor: Platform.select({
					ios: COLORS[colorScheme ?? "light"].tab_bar_background_ios,
					default: COLORS[colorScheme ?? "light"].tab_bar_background_default,
				}),
			}}
			onLayout={({
				nativeEvent: {
					layout: { height },
				},
			}) => {
				nativeBottomTabBarHeightCallback(height);
			}}
		>
			{Platform.OS === "ios" ? (
				<BlurView
					blurRadius={20}
					overlayColor={overlayColor}
					blurType={blurType}
					blurAmount={100}
					style={[StyleSheet.absoluteFillObject]}
				/>
			) : null}
			<ThemeBottomTabbar {...props} />
		</View>
	);
};
