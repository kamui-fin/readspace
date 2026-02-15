import Svg, { G, Path } from 'react-native-svg';

export interface LanguageIconProps {
  size?: number;
  color?: string;
}

export const LanguageIcon = ({ size = 24, color = 'currentColor' }: LanguageIconProps) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
        <Path d="M9 6.371C9 10.789 6.761 13 4 13m0-6.629h7" />
        <Path d="M5 9c0 2.144 2.252 3.908 6 4m1 7l4-9l4 9m-.9-2h-6.2M6.694 3l.793.582" />
      </G>
    </Svg>
  );
};
