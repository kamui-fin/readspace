import { Sparkle } from '@components/icons/svg';
import { BackButton } from '@components/ui/back-button';
import { Button } from '@components/ui/button';
import { COLORS } from '@lib/constants/colors';
import type { ReaderSurfaceColors } from '@lib/constants/reader';
import {
  BookmarkIcon,
  CheckCircleIcon,
  CopyIcon,
  MenuDotsIcon,
  ShareIcon,
} from '@solar-icons/react-native/bold';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ArticleActionBarProps {
  /** Whether the bar is shown. Owned by the screen: tapping the page toggles it. */
  visible?: boolean;
  onClose: () => void;
  onShare: () => void;
  onBookmark: () => void;
  onMenuPress?: () => void;
  hideMenu?: boolean;
  onGenerateSummary?: () => void;
  onCopyLink?: () => void;
  isBookmarked: boolean;
  isClipped: boolean;
  /** Swap the bookmark for a "mark as read & remove from read later" checkmark */
  showDone?: boolean;
  menuTrigger?: ReactNode;
  colors: ReaderSurfaceColors;
}

/** Quick on purpose — chrome should feel like it was already there. */
const BAR_DURATION_MS = 140;

export function ArticleActionBar({
  visible = true,
  onClose,
  onShare,
  onBookmark,
  onMenuPress,
  hideMenu = false,
  onGenerateSummary,
  onCopyLink,
  isBookmarked,
  isClipped,
  showDone = false,
  menuTrigger,
  colors,
}: ArticleActionBarProps) {
  const insets = useSafeAreaInsets();

  const [barHeight, setBarHeight] = useState(0);
  const shown = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    shown.value = withTiming(visible ? 1 : 0, { duration: BAR_DURATION_MS });
  }, [visible, shown]);

  // Tapping the page toggles this bar, so it must stop catching touches the
  // moment it's hidden — otherwise an invisible back button eats taps.
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: -barHeight * (1 - shown.value) }],
  }));

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: insets.top + 12,
          zIndex: 10,
        },
        animatedStyle,
      ]}
      onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}>
      <View className="flex-row items-center justify-between px-4 py-3">
        {/* Close Button */}
        <BackButton onPress={onClose} color={colors.grey} isDark={colors === COLORS.dark} />

        {/* Right Actions */}
        <View className="flex-row items-center gap-3">
          <Button variant="icon" size="small" fullWidth={false} onPress={onShare}>
            <ShareIcon size={18} strokeWidth={2.4} color={colors.grey} />
          </Button>

          {!isClipped && onGenerateSummary && (
            <Button variant="icon" size="small" fullWidth={false} onPress={onGenerateSummary}>
              <Sparkle width={18} height={18} color={colors.grey} />
            </Button>
          )}

          {onCopyLink && (
            <Button variant="icon" size="small" fullWidth={false} onPress={onCopyLink}>
              <CopyIcon size={18} strokeWidth={2.4} color={colors.grey} />
            </Button>
          )}

          <Button
            variant="icon"
            size="small"
            fullWidth={false}
            onPress={onBookmark}
            style={
              !showDone && isBookmarked ? { backgroundColor: colors.icon_bg_yellow } : undefined
            }>
            {showDone ? (
              <CheckCircleIcon size={18} color={colors.secondary} strokeWidth={2.4} />
            ) : (
              <BookmarkIcon
                size={18}
                color={isBookmarked ? '#FBBC04' : colors.grey}
                strokeWidth={2.4}
              />
            )}
          </Button>

          {!hideMenu &&
            (menuTrigger || (
              <Pressable onPress={onMenuPress} hitSlop={12}>
                <MenuDotsIcon
                  size={18}
                  strokeWidth={2.4}
                  color={colors.grey}
                  style={{ transform: [{ rotate: '90deg' }] }}
                />
              </Pressable>
            ))}
        </View>
      </View>
    </Animated.View>
  );
}
