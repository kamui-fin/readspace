import { TouchableOpacity } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { styles } from './styles';
import { ANIMATION_DURATION } from './constants';
import { ExpandVerticalIcon } from '@components/icons/expand-vertical';
import { COLORS } from '@lib/constants/colors';
import { useIsDarkMode } from '@hooks/useIsDarkMode';

interface ExpandTabProps {
  animationProgress: SharedValue<number>;
  colors: unknown;
  onPress: () => void;
}

export const ExpandTab: React.FC<ExpandTabProps> = ({
  animationProgress,
  colors: _,
  onPress: onExpandPress,
}) => {
  const isDark = useIsDarkMode();
  const tabBarColors = COLORS[isDark ? 'dark' : 'light'];

  const onPress = (): void => {
    onExpandPress?.();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (animationProgress.value === 0) {
      animationProgress.value = withTiming(1, {
        duration: ANIMATION_DURATION,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
    } else {
      animationProgress.value = withTiming(0, {
        duration: ANIMATION_DURATION,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
    }
  };

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
      [1, 2, 1],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ scale: counterScale }],
    };
  });

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.tab}>
      <Animated.View style={[styles.dummyIcon, animatedIconStyle]}>
        <ExpandVerticalIcon size={24} color={tabBarColors.grey} />
      </Animated.View>
    </TouchableOpacity>
  );
};
