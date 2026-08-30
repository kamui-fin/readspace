import { styles } from '@components/navigation/bottom-tabs/ui/expand-tab/expand-tab.styles';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { LibraryIcon } from '@solar-icons/react-native/bold-duotone';
import * as Haptics from 'expo-haptics';
import { TouchableOpacity } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

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
    // Animation logic removed - this tab now only opens the feed switcher
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
      <Animated.View style={[styles.expandTabIcon, animatedIconStyle]}>
        <LibraryIcon size={24} color={tabBarColors.grey} />
      </Animated.View>
    </TouchableOpacity>
  );
};
