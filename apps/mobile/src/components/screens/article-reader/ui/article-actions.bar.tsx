import { Button } from '@components/ui/button';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { Monicon } from '@monicon/native';
import { type ReactNode, useEffect, useState } from 'react';
import { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ArticleActionBarProps {
  scrollY?: SharedValue<number>;
  scrollDirection?: SharedValue<'up' | 'down'>;
  onClose: () => void;
  onShare: () => void;
  onBookmark: () => void;
  onMenuPress: () => void;
  isBookmarked: boolean;
  isClipped: boolean;
  menuTrigger?: ReactNode;
}

export function ArticleActionBar({
  scrollY,
  scrollDirection,
  onClose,
  onShare,
  onBookmark,
  onMenuPress,
  isBookmarked,
  isClipped,
  menuTrigger,
}: ArticleActionBarProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const greyColor = isDark ? COLORS.dark.grey : COLORS.light.grey;
  const insets = useSafeAreaInsets();
  const topInset = useSharedValue(insets.top);

  const [actionBarHeightState, setActionBarHeight] = useState(0);
  const actionBarHeight = useSharedValue(0);

  // Update top inset when insets change
  useEffect(() => {
    topInset.value = insets.top;
  }, [insets.top, topInset]);

  // Update SharedValue when state changes
  useEffect(() => {
    actionBarHeight.value = actionBarHeightState;
  }, [actionBarHeightState, actionBarHeight]);

  // Animated style for translate upward and fade based on scroll
  const animatedStyle = useAnimatedStyle(() => {
    // If scroll props are not provided (loading/error states), always show
    if (!scrollY || !scrollDirection) {
      return {
        opacity: 1,
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        paddingTop: topInset.value + 12,
        zIndex: 10,
        transform: [{ translateY: 0 }],
      };
    }

    const scrollPosition = scrollY.value;
    const isScrollingDown = scrollDirection.value === 'down';

    // Clamp scrollY to 0 if it's very small (handles floating point precision)
    const clampedScrollY = scrollPosition < 1 ? 0 : scrollPosition;

    // If actionBarHeight is 0 or scrollY is 0, ensure translation is 0
    if (actionBarHeight.value === 0 || clampedScrollY === 0) {
      return {
        opacity: 1,
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        paddingTop: topInset.value + 12,
        zIndex: 10,
        transform: [{ translateY: 0 }],
      };
    }

    // Translate upward as you scroll down (similar to header)
    const translation = interpolate(
      clampedScrollY,
      [0, actionBarHeight.value],
      [0, -actionBarHeight.value],
      Extrapolation.CLAMP
    );

    // Fade out as you scroll down, but show when scrolling up
    let opacity: number;
    if (isScrollingDown && clampedScrollY > 50) {
      // Scrolling down past threshold, fade out
      opacity = interpolate(clampedScrollY, [50, 100], [1, 0], Extrapolation.CLAMP);
    } else {
      // At top or scrolling up, fully visible
      opacity = 1;
    }

    return {
      opacity,
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      paddingTop: topInset.value + 12,
      zIndex: 10,
      transform: [{ translateY: translation }],
    };
  });

  return (
    <Animated.View
      style={animatedStyle}
      className="flex-row items-center justify-between bg-transparent px-4 py-3"
      onLayout={(e) => setActionBarHeight(e.nativeEvent.layout.height)}>
      {/* Close Button */}
      <Button variant="icon" size="small" fullWidth={false} onPress={onClose}>
        <Monicon name="solar:arrow-left-linear" size={18} strokeWidth={2.4} color={greyColor} />
      </Button>

      {/* Right Actions */}
      <View className="flex-row items-center gap-3">
        {/* Share Button */}
        <Button variant="icon" size="small" fullWidth={false} onPress={onShare}>
          <Monicon name="solar:share-bold" size={18} strokeWidth={2.4} color={greyColor} />
        </Button>

        {/* Bookmark Button (or Done button for clipped articles) */}
        <Button
          variant="icon"
          size="small"
          fullWidth={false}
          onPress={onBookmark}
          style={
            !isClipped && isBookmarked
              ? {
                  backgroundColor: colors.icon_bg_yellow,
                }
              : undefined
          }>
          <Monicon
            name={
              isClipped
                ? 'solar:check-circle-bold'
                : isBookmarked
                  ? 'solar:bookmark-bold'
                  : 'solar:bookmark-linear'
            }
            size={18}
            color={isClipped ? colors.secondary : isBookmarked ? '#FBBC04' : greyColor}
            strokeWidth={2.4}
          />
        </Button>

        {/* Menu Button */}
        {menuTrigger || (
          <Button variant="icon" size="small" fullWidth={false} onPress={onMenuPress}>
            <View style={{ transform: [{ rotate: '90deg' }] }}>
              <Monicon name="solar:menu-dots-bold" size={18} strokeWidth={2.4} color={greyColor} />
            </View>
          </Button>
        )}
      </View>
    </Animated.View>
  );
}
