import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { Animated, View } from 'react-native';

interface PageIndicatorProps {
  count: number;
  current: Animated.Value;
  size?: number;
  dashSize?: number;
  gap?: number;
  color?: string;
  activeColor?: string;
}

export function PageIndicator({
  count,
  current,
  size = 4,
  gap = 0,
  color,
  activeColor,
}: PageIndicatorProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const defaultColor = color || colors.grey4;
  const defaultActiveColor = activeColor || colors.primary;

  return (
    <View className="w-full flex-row items-center justify-between">
      {Array.from({ length: count }, (_, index) => {
        const isActive = current.interpolate({
          inputRange: [index - 0.01, index, index + 0.01],
          outputRange: [0, 1, 0],
          extrapolate: 'clamp',
        });

        return (
          <View
            key={`page-indicator-${index.toString()}`}
            className="relative flex-1"
            style={{
              height: size,
              marginHorizontal: gap / 2,
            }}>
            {/* Inactive background */}
            <View
              className="absolute h-full w-full"
              style={{
                backgroundColor: defaultColor,
              }}
            />
            {/* Active overlay */}
            <Animated.View
              className="absolute h-full w-full"
              style={{
                backgroundColor: defaultActiveColor,
                opacity: isActive,
              }}
            />
          </View>
        );
      })}
    </View>
  );
}
