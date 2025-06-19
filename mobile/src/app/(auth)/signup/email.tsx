import Monicon from "@monicon/native";
import { TextInput } from "@showtime-xyz/universal.text-input";
import { View } from "@showtime-xyz/universal.view";
import { Text } from "@components/Themed";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, TYPOGRAPHY } from "@lib/constants";

export default function EmailScreen() {
	const insets = useSafeAreaInsets();
	const colors = COLORS.light;

	return (
		<View
			style={{
				paddingHorizontal: 28,
				backgroundColor: colors.background,
				justifyContent: "flex-start",
				flex: 1,
			}}
		>
			<View style={{ paddingVertical: 1.2 * insets.bottom }}>
				<Text style={{ ...TYPOGRAPHY.STYLES.headerSmall }}>
					Enter your email
				</Text>
				<Text style={{ ...TYPOGRAPHY.STYLES.headerLarge }}>
					What's your email address?
				</Text>
			</View>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					borderWidth: 2,
					borderColor: colors.grey3,
					borderRadius: 12,
					paddingHorizontal: 16,
					marginBottom: 1.6 * insets.bottom,
					backgroundColor: colors.grey5,
				}}
			>
				<TextInput
					placeholder="john@example.com"
					placeholderClassName="text-xl"
					style={{
						flex: 1,
						padding: 16,
					}}
				/>
			</View>
		</View>
	);
}
