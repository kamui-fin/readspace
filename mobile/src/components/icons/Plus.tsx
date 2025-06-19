import React from "react";
import { Svg, Path } from "react-native-svg";

interface PlusProps {
	width?: number;
	height?: number;
	color?: string;
}

export const Plus: React.FC<PlusProps> = ({
	width = 24,
	height = 24,
	color = "#000000",
}) => {
	return (
		<Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
			<Path
				d="M12 4V20"
				stroke={color}
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<Path
				d="M4 12H20"
				stroke={color}
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</Svg>
	);
};
