import Svg, { Path } from 'react-native-svg';

export interface PlusIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function PlusIcon({ size = 24, color = 'currentColor', strokeWidth = 1.5 }: PlusIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 12h-3m0 0H9m3 0V9m0 3v3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
