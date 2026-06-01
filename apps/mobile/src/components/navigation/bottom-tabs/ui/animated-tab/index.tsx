import { styles } from '@components/navigation/bottom-tabs/ui/animated-tab/animated-tab.styles';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

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

  const handlePress = (): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const handleLongPress = (): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={styles.tab}>
      <Animated.View
        style={[
          styles.tabBackground,
          animatedBackgroundStyle,
          {
            backgroundColor: isDark
              ? tabBarColors.primary_light || 'rgba(106, 153, 78, 0.2)'
              : 'rgba(106, 153, 78, 0.15)',
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
