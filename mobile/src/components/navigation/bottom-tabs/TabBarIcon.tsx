import { Monicon, type MoniconProps } from "@monicon/native";
import React from "react";
import { View } from "react-native";

interface SvgIconProps {
	width?: number;
	height?: number;
	color?: string;
	filled?: boolean;
}

interface TabBarIconProps extends Partial<MoniconProps> {
	className?: string;
	component?: React.ComponentType<SvgIconProps>;
	name?: string;
	focused?: boolean;
}

export function TabBarIcon({
	className,
	component: SvgComponent,
	name,
	focused,
	...props
}: TabBarIconProps) {
	const iconElement = SvgComponent ? (
		<SvgComponent
			width={props.size || 24}
			height={props.size || 24}
			color={props.color}
			filled={focused}
		/>
	) : name ? (
		<Monicon name={name} {...props} />
	) : null;

	if (className) {
		return <View className={className}>{iconElement}</View>;
	}

	return iconElement;
}
