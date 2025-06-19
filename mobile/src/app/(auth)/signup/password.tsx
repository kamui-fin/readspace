import Monicon from "@monicon/native";
import { View } from "@showtime-xyz/universal.view";
import { Text } from "@components/Themed";
import { COLORS, TYPOGRAPHY } from "@lib/constants";
import { useSafeAreaInsets } from "@showtime-xyz/universal.safe-area";
import { TextInput } from "react-native-gesture-handler";

export default function PasswordScreen() {
	const insets = useSafeAreaInsets();
	const colors = COLORS.light;

	return (
		<View
			style={{
				paddingHorizontal: 28,
				paddingVertical: 10 * insets.bottom,
				backgroundColor: colors.background,
				justifyContent: "flex-start",
				flex: 1,
			}}
		>
			<View style={{ paddingVertical: 1.2 * insets.bottom }}>
				<Text style={{ ...TYPOGRAPHY.STYLES.headerSmall }}>Set Password</Text>
				<Text style={{ ...TYPOGRAPHY.STYLES.headerLarge }}>
					Pick a password to log in to your account.
				</Text>
			</View>
		</View>
	);
}
