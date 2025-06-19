import React from "react";
import { Svg, Path, Rect } from "react-native-svg";

interface NewspaperProps {
	width?: number;
	height?: number;
	color?: string;
}

export const Newspaper: React.FC<NewspaperProps> = ({
	width = 24,
	height = 24,
	color = "#000000",
}) => {
	return (
		<Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
			<Path
				d="M15 18h-5"
				stroke={color}
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<Path
				d="M18 14h-8"
				stroke={color}
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<Path
				d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2"
				stroke={color}
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<Rect
				width="8"
				height="4"
				x="10"
				y="6"
				rx="1"
				stroke={color}
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</Svg>
	);
};
