import { View } from "@showtime-xyz/universal.view";
import { TextInput } from "@showtime-xyz/universal.text-input";
import { Text } from "@components/Themed";
import { useSafeAreaInsets } from "@showtime-xyz/universal.safe-area";
import { COLORS, TYPOGRAPHY } from "@lib/constants";

export default function UsernameScreen() {
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
				<Text style={{ ...TYPOGRAPHY.STYLES.headerSmall }}>Pick a handle</Text>
				<Text style={{ ...TYPOGRAPHY.STYLES.headerLarge }}>
					What should we call you?
				</Text>
			</View>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					borderWidth: 2,
					borderColor: colors.grey3,
					borderRadius: 12,
					marginBottom: 0.96 * insets.bottom,
					backgroundColor: colors.grey5,
				}}
			>
				<TextInput
					placeholder="Your username"
					style={{
						flex: 1,
						padding: 16,
					}}
				/>
			</View>
		</View>
	);
}
