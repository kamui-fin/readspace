import { router } from "expo-router";
import { StatusBar, View, Pressable } from "react-native";
import { Text } from "@components/Themed";
import { useSafeAreaInsets } from "@showtime-xyz/universal.safe-area";
import { GoogleOriginal } from "@showtime-xyz/universal.icon";
import { COLORS, TYPOGRAPHY } from "@lib/constants";
import { useColorScheme } from "@hooks/useColorScheme";
import { Logo, RSS, Newspaper } from "@/src/components/icons";
import { Button } from "@/src/components/ui/Button";

export default function WelcomeScreen() {
	const insets = useSafeAreaInsets();
	const colorScheme = useColorScheme();
	const colors = COLORS[colorScheme ?? "light"];

	return (
		<View
			className="flex-1"
			style={{ paddingTop: insets.top, backgroundColor: colors.background }}
		>
			<StatusBar
				barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
			/>

			{/* Top-right Login Button */}
			<View
				className="absolute top-4 right-4 z-10"
				style={{ marginTop: insets.top }}
			>
				<Button variant="text" onPress={() => router.push("/login")}>
					<Text
						style={{
							...TYPOGRAPHY.STYLES.headerSmall,
							color: colorScheme === "dark" ? colors.grey3 : colors.grey2,
						}}
					>
						Login
					</Text>
				</Button>
			</View>

			{/* Main Content */}
			<View className="flex-1 justify-center items-start px-8">
				<View className="flex-row items-center mb-6">
					<Logo width={60} height={60} borderRadius={10} />
					<Text
						style={{
							...TYPOGRAPHY.STYLES.headerLarge,
							color: colors.foreground,
							marginLeft: 12,
						}}
					>
						Readspace
					</Text>
				</View>
				<View
					style={{
						flexDirection: "row",
						flexWrap: "wrap",
						alignItems: "center",
						marginBottom: 12,
					}}
				>
					<Text
						style={{
							...TYPOGRAPHY.STYLES.bodyLarge,
							fontSize: 28,
							lineHeight: 32,
							fontWeight: "700",
							color: colors.foreground,
						}}
					>
						A{" "}
					</Text>
					<RSS width={24} height={24} color={colors.foreground} />
					<Text
						style={{
							...TYPOGRAPHY.STYLES.bodyLarge,
							fontSize: 28,
							lineHeight: 32,
							fontWeight: "700",
							color: colors.foreground,
							marginLeft: 8,
						}}
					>
						RSS reader and{" "}
					</Text>
					<Text
						style={{
							...TYPOGRAPHY.STYLES.bodyLarge,
							fontSize: 28,
							lineHeight: 32,
							fontWeight: "700",
							color: colors.foreground,
						}}
					>
						personal{" "}
					</Text>
					<Newspaper width={24} height={24} color={colors.foreground} />
					<Text
						style={{
							...TYPOGRAPHY.STYLES.bodyLarge,
							fontSize: 28,
							lineHeight: 32,
							fontWeight: "700",
							color: colors.foreground,
							marginLeft: 8,
						}}
					>
						newsstand{" "}
					</Text>
					<Text
						style={{
							...TYPOGRAPHY.STYLES.bodyLarge,
							fontSize: 28,
							lineHeight: 32,
							fontWeight: "700",
							color: colors.foreground,
						}}
					>
						in your pocket
					</Text>
				</View>
			</View>

			{/* Footer with Google Login Button */}
			<View
				style={{
					paddingBottom: 1.6 * insets.bottom,
					paddingHorizontal: 20,
					justifyContent: "center",
					alignItems: "center",
				}}
			>
				<Button
					size="large"
					onPress={() => router.push("/login")}
					className="flex-row items-center justify-center rounded-xl py-6 w-full"
					style={{
						backgroundColor: colors.primary,
					}}
				>
					<View
						style={{
							position: "relative",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<GoogleOriginal
							width={32}
							height={32}
							style={{
								position: "absolute",
								left: -24,
								top: "50%",
								transform: [{ translateX: -20 }, { translateY: -16 }],
							}}
						/>
						<Text
							style={{
								...TYPOGRAPHY.STYLES.bodyLarge,
								color: COLORS.white,
							}}
						>
							Continue with Google
						</Text>
					</View>
				</Button>
				<Button
					variant="text"
					className="mx-4 bg-transparent border-0"
					onPress={() => router.push("/signup")}
				>
					<Text
						style={{
							...TYPOGRAPHY.STYLES.bodyLarge,
							color: colors.grey,
						}}
					>
						Or use email instead
					</Text>
				</Button>
			</View>
		</View>
	);
}
