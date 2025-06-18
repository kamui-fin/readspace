import React from "react";
import { Svg, Path } from "react-native-svg";

interface BookmarkProps {
	width?: number;
	height?: number;
	color?: string;
	filled?: boolean;
}

export const Bookmark: React.FC<BookmarkProps> = ({
	width = 24,
	height = 24,
	color = "#000000",
	filled = false,
}) => {
	return (
		<Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
			{filled ? (
				// Solid version when focused - similar to HugeIcons solid bookmark
				<Path
					fillRule="evenodd"
					clipRule="evenodd"
					d="M5.17157 3.12874C4 4.25748 4 6.07416 4 9.70753V17.9808C4 20.2867 4 21.4396 4.77285 21.8523C6.26947 22.6514 9.0768 19.9852 10.41 19.1824C11.1832 18.7168 11.5698 18.484 12 18.484C12.4302 18.484 12.8168 18.7168 13.59 19.1824C14.9232 19.9852 17.7305 22.6514 19.2272 21.8523C20 21.4396 20 20.2867 20 17.9808V9.70753C20 6.07416 20 4.25748 18.8284 3.12874C17.6569 2 15.7712 2 12 2C8.22876 2 6.34315 2 5.17157 3.12874ZM4 7C4 6.44772 4.44772 6 5 6H19C19.5523 6 20 6.44772 20 7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7Z"
					fill={color}
				/>
			) : (
				// Outline version when not focused
				<>
					<Path
						d="M4 17.9808V9.70753C4 6.07416 4 4.25748 5.17157 3.12874C6.34315 2 8.22876 2 12 2C15.7712 2 17.6569 2 18.8284 3.12874C20 4.25748 20 6.07416 20 9.70753V17.9808C20 20.2867 20 21.4396 19.2272 21.8523C17.7305 22.6514 14.9232 19.9852 13.59 19.1824C12.8168 18.7168 12.4302 18.484 12 18.484C11.5698 18.484 11.1832 18.7168 10.41 19.1824C9.0768 19.9852 6.26947 22.6514 4.77285 21.8523C4 21.4396 4 20.2867 4 17.9808Z"
						stroke={color}
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					<Path d="M4 7H20" stroke={color} strokeWidth="1.5" />
				</>
			)}
		</Svg>
	);
};
