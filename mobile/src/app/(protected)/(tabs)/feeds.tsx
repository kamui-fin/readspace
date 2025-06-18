import { StyleSheet, View, Text, useWindowDimensions } from "react-native";
import { TYPOGRAPHY, COLORS } from "@lib/constants";
import { useState, useRef, useCallback } from "react";
import { TopTabs } from "@/src/components/navigation/tab-view/TopTabs";
import Animated, {
	useSharedValue,
	useAnimatedScrollHandler,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "@showtime-xyz/universal.safe-area";

const ForYou = () => (
	<View style={styles.content}>
		<Text style={styles.subtitle}>
			Discover the latest articles and updates from your sources
		</Text>
	</View>
);

const Following = () => (
	<View style={styles.content}>
		<Text style={styles.subtitle}>
			Updates from the sources you are following will appear here
		</Text>
	</View>
);

export default function FeedsScreen() {
	const { width } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const [routes] = useState([
		{ key: "foryou", title: "For you" },
		{ key: "following", title: "Following" },
	]);
	const tabNames = routes.map((r) => r.title);
	const flatListRef = useRef<any>(null);

	const indexDecimal = useSharedValue(0);

	const onTabPress = useCallback(
		(name: string) => {
			const index = routes.findIndex((r) => r.title === name);
			flatListRef.current?.scrollToIndex({ index });
		},
		[routes],
	);

	const scrollHandler = useAnimatedScrollHandler({
		onScroll: (event) => {
			indexDecimal.value = event.contentOffset.x / width;
		},
	});

	return (
		<View style={[styles.container, { paddingTop: 0.2 * insets.top }]}>
			<TopTabs
				tabNames={tabNames}
				indexDecimal={indexDecimal}
				onTabPress={onTabPress}
			/>
			<Animated.FlatList
				ref={flatListRef}
				data={routes}
				renderItem={({ item }) => {
					const Scene = item.key === "foryou" ? ForYou : Following;
					return (
						<View style={{ width }}>
							<Scene />
						</View>
					);
				}}
				keyExtractor={(item) => item.key}
				horizontal
				pagingEnabled
				showsHorizontalScrollIndicator={false}
				onScroll={scrollHandler}
				scrollEventThrottle={16}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: COLORS.light.background,
	},
	header: {
		paddingHorizontal: 20,
		paddingVertical: 12,
	},
	title: {
		...TYPOGRAPHY.STYLES.headerLarge,
		color: COLORS.light.foreground,
	},
	content: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 20,
	},
	subtitle: {
		...TYPOGRAPHY.STYLES.bodyMedium,
		color: COLORS.light.grey,
		textAlign: "center",
		lineHeight: 22,
	},
	tabBar: {
		backgroundColor: COLORS.light.background,
		borderBottomWidth: 0,
		elevation: 0,
		shadowOpacity: 0,
	},
	tabContentContainer: {
		flexGrow: 1,
		justifyContent: "center",
	},
	indicator: {
		backgroundColor: COLORS.light.foreground,
		justifyContent: "center",
		alignItems: "center",
		height: 2,
	},
	tab: {
		width: "auto",
		paddingHorizontal: 20,
	},
	tabLabel: {
		...TYPOGRAPHY.STYLES.button,
		textTransform: "none",
		fontSize: 16,
		fontWeight: "500",
		color: COLORS.light.grey,
	},
});
