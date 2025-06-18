import React from "react";
import { Svg, Path, Circle } from "react-native-svg";

interface SearchProps {
	width?: number;
	height?: number;
	color?: string;
	filled?: boolean;
}

export const Search: React.FC<SearchProps> = ({
	width = 24,
	height = 24,
	color = "#000000",
}) => {
	return (
		<Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
			{/* Always show outline version - no focused state */}
			<Circle
				cx="11"
				cy="11"
				r="8"
				stroke={color}
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<Path
				d="m21 21-4.35-4.35"
				stroke={color}
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</Svg>
	);
};
