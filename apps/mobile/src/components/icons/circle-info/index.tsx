import Svg, { Path } from 'react-native-svg';

export interface CircleInfoIconProps {
  size?: number;
  color?: string;
}

export const CircleInfoIcon = ({ size = 24, color = 'currentColor' }: CircleInfoIconProps) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12S6.477 2 12 2s10 4.477 10 10m-10 5.75a.75.75 0 0 0 .75-.75v-6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75M12 7a1 1 0 1 1 0 2a1 1 0 0 1 0-2"
      />
    </Svg>
  );
};
