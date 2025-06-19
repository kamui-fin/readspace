import { View } from "@showtime-xyz/universal.view";
import { Text } from "@components/Themed";
import { useSafeAreaInsets } from "@showtime-xyz/universal.safe-area";
import { COLORS, TYPOGRAPHY } from "@lib/constants";
import { Button } from "@components/ui/Button";

export default function NotificationsScreen() {
	const insets = useSafeAreaInsets();
	const colors = COLORS.light;

	return (
		<View
			style={{
				paddingHorizontal: 28,
				paddingTop: 10.7 * insets.bottom,
				backgroundColor: colors.background,
				justifyContent: "flex-start",
				flex: 1,
			}}
		>
			<View style={{ paddingVertical: 1.2 * insets.bottom }}>
				<Text style={{ ...TYPOGRAPHY.STYLES.headerSmall }}>
					Notification Preferences
				</Text>
				<Text style={{ ...TYPOGRAPHY.STYLES.headerLarge }}>
					Turn on them on so you don't miss any updates
				</Text>
			</View>
		</View>
	);
}
