import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import Svg, { Circle } from 'react-native-svg';

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

  const primaryColor = color ?? (isDark ? COLORS.dark.secondary : COLORS.light.secondary);

  const isWhiteColor = (c: string) => {
    const lower = c.toLowerCase().trim();
    return (
      lower === '#ffffff' ||
      lower === 'white' ||
      lower === 'rgb(252, 255, 252)' ||
      lower === 'rgb(255, 255, 255)'
    );
  };

  const secondaryColor = secondaryColorProp
    ? secondaryColorProp
    : isWhiteColor(primaryColor)
      ? 'rgba(255, 255, 255, 0.2)'
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
