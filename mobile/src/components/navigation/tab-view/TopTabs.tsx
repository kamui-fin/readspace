import React from "react";
import { View, StyleSheet } from "react-native";
import { TabItem } from "./TabItem";
import { TabIndicator } from "./TabIndicator";
import { SharedValue } from "react-native-reanimated";

const TABS_HORIZONTAL_PADDING = 16;

type Props = {
	tabNames: string[];
	indexDecimal: SharedValue<number>;
	onTabPress: (name: string) => void;
};

export function TopTabs({ tabNames, indexDecimal, onTabPress }: Props) {
	return (
		<View>
			<View
				style={[
					styles.container,
					{ paddingHorizontal: TABS_HORIZONTAL_PADDING },
				]}
			>
				{tabNames.map((tab, index) => {
					return (
						<TabItem
							key={tab}
							index={index}
							tabName={tab}
							indexDecimal={indexDecimal}
							onPress={() => {
								onTabPress(tab);
							}}
						/>
					);
				})}
			</View>
			<TabIndicator
				indexDecimal={indexDecimal}
				numberOfTabs={tabNames.length}
				tabsHorizontalPadding={TABS_HORIZONTAL_PADDING}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		paddingBottom: 8,
	},
});
