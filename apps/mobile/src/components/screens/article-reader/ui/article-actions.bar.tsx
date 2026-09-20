import { ArticleActionGroup } from '@components/screens/article-reader/ui/article-action-group';
import { ArticleOptionsMenu } from '@components/screens/article-reader/ui/article-options-menu';
import { BackButton } from '@components/ui/back-button';
import { BAR_ICON_SIZE } from '@lib/constants/app';
import { MenuDotsIcon } from '@solar-icons/react-native/bold';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ArticleActionBarProps } from './article-actions.bar.types';

export type { ArticleActionBarProps } from './article-actions.bar.types';

/** Quick on purpose — chrome should feel like it was already there. */
const BAR_DURATION_MS = 140;

/** Android / default reader chrome: our own floating bar. iOS uses the real navigation bar. */
export function ArticleActionBar({
  visible = true,
  onClose,
  onShare,
  onBookmark,
  onGenerateSummary,
  onCopyLink,
  isBookmarked,
  isClipped,
  showDone = false,
  options,
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
          // The bar floats over the article, so it needs the page's own surface behind it —
          // without a fill, body text scrolls through the icons. No rule underneath: the fill
          // already separates it, and a hairline there reads as a seam.
          backgroundColor: colors.background,
        },
        animatedStyle,
      ]}
      onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}>
      <View className="flex-row items-center justify-between px-4 py-3">
        {/* Close Button */}
        <BackButton onPress={onClose} color={colors.grey} />

        {/* Right Actions */}
        <View className="flex-row items-center gap-3">
          <ArticleActionGroup
            colors={colors}
            onShare={onShare}
            onBookmark={onBookmark}
            onGenerateSummary={onGenerateSummary}
            onCopyLink={onCopyLink}
            isBookmarked={isBookmarked}
            isClipped={isClipped}
            showDone={showDone}
          />

          {options && (
            // The overflow control opens a real anchored menu, not a sheet: everything it
            // holds is either a one-shot action or a checked choice, and both are what a
            // menu is for.
            <ArticleOptionsMenu model={options}>
              <View
                pointerEvents="none"
                accessible
                accessibilityRole="button"
                accessibilityLabel="More options"
                style={{
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 22,
                  backgroundColor: colors.grey5,
                }}>
                {/* Turned a quarter turn: overflow dots read vertically, matching the iOS bar. */}
                <MenuDotsIcon
                  size={BAR_ICON_SIZE}
                  strokeWidth={2.4}
                  color={colors.grey}
                  style={{ transform: [{ rotate: '90deg' }] }}
                />
              </View>
            </ArticleOptionsMenu>
          )}
        </View>
      </View>
    </Animated.View>
  );
}
