import React from "react";
import { StyleSheet } from "react-native";

import { MonoText } from "@components/StyledText";
import { Text, View } from "@components/Themed";
import { TYPOGRAPHY } from "@lib/constants";

export default function EditScreenInfo({ path }: { path: string }) {
	return (
		<View>
			<View style={styles.getStartedContainer}>
				<Text
					style={styles.getStartedText}
					lightColor="rgba(0,0,0,0.8)"
					darkColor="rgba(255,255,255,0.8)"
				>
					Open up the code for this screen:
				</Text>

				<View
					style={[styles.codeHighlightContainer, styles.homeScreenFilename]}
					darkColor="rgba(255,255,255,0.05)"
					lightColor="rgba(0,0,0,0.05)"
				>
					<MonoText>{path}</MonoText>
				</View>

				<Text
					style={styles.getStartedText}
					lightColor="rgba(0,0,0,0.8)"
					darkColor="rgba(255,255,255,0.8)"
				>
					Change any of the text, save the file, and your app will automatically
					update.
				</Text>
			</View>

			<View style={styles.helpContainer}>
				<ExternalLink
					style={styles.helpLink}
					href="https://docs.expo.io/get-started/create-a-new-app/#opening-the-app-on-your-phonetablet"
				>
					<Text style={styles.helpLinkText} lightColor="#2e78b7">
						Tap here if your app doesn't automatically update after making
						changes
					</Text>
				</ExternalLink>
			</View>
		</View>
	);
}

function ExternalLink(props: {
	href: string;
	style?: any;
	children: React.ReactNode;
}) {
	return (
		<Text
			{...props}
			style={[props.style, { color: "#2e78b7" }]}
			onPress={() => {
				// Open external link
			}}
		/>
	);
}

const styles = StyleSheet.create({
	getStartedContainer: {
		alignItems: "center",
		marginHorizontal: 50,
	},
	homeScreenFilename: {
		marginVertical: 7,
	},
	codeHighlightContainer: {
		borderRadius: 3,
		paddingHorizontal: 4,
	},
	getStartedText: {
		...TYPOGRAPHY.STYLES.bodyMedium,
		lineHeight: 24,
		textAlign: "center",
	},
	helpContainer: {
		marginTop: 15,
		marginHorizontal: 20,
		alignItems: "center",
	},
	helpLink: {
		paddingVertical: 15,
	},
	helpLinkText: {
		...TYPOGRAPHY.STYLES.bodySmall,
		textAlign: "center",
	},
});
