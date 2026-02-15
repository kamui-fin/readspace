import Svg, { Path } from 'react-native-svg';

export interface ExpandVerticalAltIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function ExpandVerticalAltIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
}: ExpandVerticalAltIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m6.375 9.75 5.625-4.875 5.625 4.875m-11.25 4.5 5.625 4.875 5.625-4.875"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
