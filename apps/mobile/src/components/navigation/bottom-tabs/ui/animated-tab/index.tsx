import { useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { styles } from './animated-tab.styles';
import { COLORS } from '@lib/constants/colors';
import { useIsDarkMode } from '@hooks/useIsDarkMode';

interface AnimatedTabProps {
  isFocused: boolean;
  options: any;
  colors: any;
  onPress: () => void;
  onLongPress: () => void;
  animationProgress: SharedValue<number>;
  index: number;
}

export const AnimatedTab: React.FC<AnimatedTabProps> = ({
  isFocused,
  options,
  colors,
  onPress,
  onLongPress,
  animationProgress,
}) => {
  const scale = useSharedValue(0);
  const isDark = useIsDarkMode();
  const tabBarColors = COLORS[isDark ? 'dark' : 'light'];

  useEffect(() => {
    scale.value = withTiming(isFocused ? 1 : 0, {
      duration: 300,
      easing: Easing.out(Easing.ease),
    });
  }, [isFocused, scale]);

  const animatedBackgroundStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scale.value, [0, 1], [0, 1]);
    return {
      opacity,
      transform: [
        {
          scale: interpolate(scale.value, [0, 1], [0.8, 1]),
        },
      ],
    };
  });

  const animatedIconStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      animationProgress.value,
      [0, 0.25, 0.4],
      [1, 0.5, 0],
      Extrapolation.CLAMP
    );

    const counterScale = interpolate(
      animationProgress.value,
      [0, 0.5, 1],
      [1, 0.5, 1],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ scale: counterScale }],
    };
  });

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tab}>
      <Animated.View
        style={[
          styles.tabBackground,
          animatedBackgroundStyle,
          {
            backgroundColor: isDark ? 'rgba(106, 153, 78, 0.2)' : 'rgba(106, 153, 78, 0.15)',
          },
        ]}
      />
      <Animated.View style={animatedIconStyle}>
        {options.tabBarIcon &&
          options.tabBarIcon({
            focused: isFocused,
            color: isFocused ? tabBarColors.secondary : tabBarColors.inactive_tint,
            size: 24,
          })}
      </Animated.View>
    </TouchableOpacity>
  );
};
