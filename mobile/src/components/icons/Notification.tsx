import React from "react";
import { Svg, Path, Circle } from "react-native-svg";

interface NotificationProps {
	width?: number;
	height?: number;
	color?: string;
	filled?: boolean;
}

export const Notification: React.FC<NotificationProps> = ({
	width = 24,
	height = 24,
	color = "#000000",
	filled = false,
}) => {
	return (
		<Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
			{filled ? (
				// Solid version when focused - similar to HugeIcons notification-square-solid-rounded
				<Path
					fillRule="evenodd"
					clipRule="evenodd"
					d="M11.5 3H12.5C16.9783 3 19.2175 3 20.6088 4.39124C22 5.78249 22 8.02166 22 12.5C22 16.9783 22 19.2175 20.6088 20.6088C19.2175 22 16.9783 22 12.5 22H11.5C7.02166 22 4.78249 22 3.39124 20.6088C2 19.2175 2 16.9783 2 12.5C2 8.02166 2 5.78249 3.39124 4.39124C4.78249 3 7.02166 3 11.5 3ZM7 10C6.44772 10 6 10.4477 6 11C6 11.5523 6.44772 12 7 12H11C11.5523 12 12 11.5523 12 11C12 10.4477 11.5523 10 11 10H7ZM7 15C6.44772 15 6 15.4477 6 16C6 16.5523 6.44772 17 7 17H15C15.5523 17 16 16.5523 16 16C16 15.4477 15.5523 15 15 15H7ZM18.5 2C16.567 2 15 3.567 15 5.5C15 7.433 16.567 9 18.5 9C20.433 9 22 7.433 22 5.5C22 3.567 20.433 2 18.5 2Z"
					fill={color}
				/>
			) : (
				// Outline version when not focused - matches notification.svg
				<>
					<Path
						d="M12.5 3H11.5C7.02166 3 4.78249 3 3.39124 4.39124C2 5.78249 2 8.02166 2 12.5C2 16.9783 2 19.2175 3.39124 20.6088C4.78249 22 7.02166 22 11.5 22C15.9783 22 18.2175 22 19.6088 20.6088C21 19.2175 21 16.9783 21 12.5V11.5"
						stroke={color}
						strokeWidth="1.5"
						strokeLinecap="round"
					/>
					<Circle cx="18.5" cy="5.5" r="3.5" stroke={color} strokeWidth="1.5" />
					<Path
						d="M7 11H11"
						stroke={color}
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					<Path
						d="M7 16H15"
						stroke={color}
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</>
			)}
		</Svg>
	);
};
