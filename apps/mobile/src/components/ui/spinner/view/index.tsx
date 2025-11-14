import Svg, { Circle } from 'react-native-svg';

import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';

const spinnerSizeMap = new Map<SpinnerProps['size'], number>([
  ['large', 48],
  ['medium', 32],
  ['small', 24],
]);

export type SpinnerProps = {
  size?: 'large' | 'medium' | 'small';
  color?: string;
  secondaryColor?: string;
  duration?: number;
};

export const getSpinnerSize = (size: SpinnerProps['size']) => {
  return spinnerSizeMap.get(size) ?? 32;
};

export const SpinnerView = ({
  size = 'medium',
  color,
  secondaryColor: secondaryColorProp,
}: SpinnerProps) => {
  const isDark = useIsDarkMode();

  const primaryColor = color ?? COLORS.light.secondary;
  const secondaryColor = secondaryColorProp
    ? secondaryColorProp
    : isDark
      ? COLORS.dark.grey4
      : COLORS.light.grey5;

  return (
    <Svg
      width={spinnerSizeMap.get(size) ?? 32}
      height={spinnerSizeMap.get(size) ?? 32}
      viewBox="0 0 32 32">
      <Circle cx={16} cy={16} fill="none" r={14} strokeWidth={4} stroke={secondaryColor} />
      <Circle
        cx={16}
        cy={16}
        fill="none"
        r={14}
        strokeWidth={4}
        stroke={primaryColor}
        strokeDasharray={80}
        strokeDashoffset={56}
      />
    </Svg>
  );
};
