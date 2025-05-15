import React from "react";
import { View } from "react-native";
import { Monicon, MoniconProps } from "@monicon/native";

interface TabBarIconProps extends MoniconProps {
	className?: string;
}

export function TabBarIcon({ className, ...props }: TabBarIconProps) {
	if (className) {
		return (
			<View className={className}>
				<Monicon {...props} />
			</View>
		);
	}
	return <Monicon {...props} />;
}
