import React from "react";
import { Svg, Path, Circle } from "react-native-svg";

interface RSSProps {
	width?: number;
	height?: number;
	color?: string;
}

export const RSS: React.FC<RSSProps> = ({
	width = 24,
	height = 24,
	color = "#000000",
}) => {
	return (
		<Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
			<Path
				d="M4 11a9 9 0 0 1 9 9"
				stroke={color}
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<Path
				d="M4 4a16 16 0 0 1 16 16"
				stroke={color}
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<Circle
				cx="5"
				cy="19"
				r="1"
				stroke={color}
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</Svg>
	);
};
