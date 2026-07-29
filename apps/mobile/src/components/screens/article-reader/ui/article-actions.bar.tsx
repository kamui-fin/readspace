import SparkleIcon from '@components/icons/local/sparkle';
import ArrowLeftLinearIcon from '@components/icons/solar/arrow-left-linear';
import BookmarkBoldIcon from '@components/icons/solar/bookmark-bold';
import BookmarkLinearIcon from '@components/icons/solar/bookmark-linear';
import CheckCircleBoldIcon from '@components/icons/solar/check-circle-bold';
import CopyBoldIcon from '@components/icons/solar/copy-bold';
import MenuDotsBoldIcon from '@components/icons/solar/menu-dots-bold';
import ShareBoldIcon from '@components/icons/solar/share-bold';
import { Button } from '@components/ui/button';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
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
  onMenuPress?: () => void;
  hideMenu?: boolean;
  onGenerateSummary?: () => void;
  onCopyLink?: () => void;
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
  hideMenu = false,
  onGenerateSummary,
  onCopyLink,
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
        <ArrowLeftLinearIcon width={18} height={18} strokeWidth={2.4} color={greyColor} />
      </Button>

      {/* Right Actions */}
      <View className="flex-row items-center gap-3">
        {/* Share Button */}
        <Button variant="icon" size="small" fullWidth={false} onPress={onShare}>
          <ShareBoldIcon width={18} height={18} strokeWidth={2.4} color={greyColor} />
        </Button>

        {/* Generate Summary Button */}
        {!isClipped && onGenerateSummary && (
          <Button variant="icon" size="small" fullWidth={false} onPress={onGenerateSummary}>
            <SparkleIcon width={18} height={18} color={greyColor} fill={greyColor} />
          </Button>
        )}

        {/* Copy Link Button */}
        {onCopyLink && (
          <Button variant="icon" size="small" fullWidth={false} onPress={onCopyLink}>
            <CopyBoldIcon width={18} height={18} strokeWidth={2.4} color={greyColor} />
          </Button>
        )}

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
          {(() => {
            const Icon = isClipped
              ? CheckCircleBoldIcon
              : isBookmarked
                ? BookmarkBoldIcon
                : BookmarkLinearIcon;
            return (
              <Icon
                width={18}
                height={18}
                color={isClipped ? colors.secondary : isBookmarked ? '#FBBC04' : greyColor}
                strokeWidth={2.4}
              />
            );
          })()}
        </Button>

        {/* Menu Button */}
        {!hideMenu &&
          (menuTrigger || (
            <Pressable onPress={onMenuPress} hitSlop={12}>
              <MenuDotsBoldIcon
                width={18}
                height={18}
                strokeWidth={2.4}
                color={greyColor}
                style={{ transform: [{ rotate: '90deg' }] }}
              />
            </Pressable>
          ))}
      </View>
    </Animated.View>
  );
}
