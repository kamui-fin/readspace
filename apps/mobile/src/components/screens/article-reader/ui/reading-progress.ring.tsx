import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface ReadingProgressRingProps {
  /** 0..1 through the article. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor: string;
  children?: ReactNode;
}

/**
 * A thin ring showing how far through the article the reader is.
 *
 * Driven by a plain number rather than a shared value on purpose: the dock
 * rounds progress to whole percent before it reaches here, so this re-renders
 * at most a hundred times over an entire article — cheap enough that an
 * animated SVG prop would be more machinery than it's worth.
 */
export function ReadingProgressRing({
  progress,
  size = 22,
  strokeWidth = 2,
  color,
  trackColor,
  children,
}: ReadingProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(progress, 0), 1);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* -90deg puts the start of the arc at 12 o'clock instead of 3 o'clock. */}
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          fill="none"
        />
      </Svg>
      {children}
    </View>
  );
}
