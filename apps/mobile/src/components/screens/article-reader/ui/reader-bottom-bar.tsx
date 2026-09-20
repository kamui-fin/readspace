import { ReaderCornerMenu } from '@components/screens/article-reader/ui/reader-corner-menu';
import {
  READER_CORNER_BUTTON_SIZE,
  READER_PROGRESS_RING_SIZE,
  READER_PROGRESS_RING_STROKE,
  type ReaderCornerMenuProps,
} from '@components/screens/article-reader/ui/reader-corner-menu.types';
import { ReadingProgressRing } from '@components/screens/article-reader/ui/reading-progress.ring';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Animated, {
  FadeIn,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Quick on purpose — chrome should feel like it was already there. */
const CHROME_DURATION_MS = 140;
const CHROME_TRAVEL = 12;

/**
 * The pill is a raised object over the page, so it needs a fill the page does not share.
 * `card` was that fill and it is nearly the page in both themes — 245/246 against white,
 * 32 against 25 — which left the control readable only by its hairline. Light mode lifts to
 * pure white (the page is already off-white and the shadow does the separating); dark mode
 * lifts *up* the grey ramp instead, since a darker pill on a dark page cannot be seen at all.
 */
const pillSurface = (colors: ReaderCornerMenuProps['colors'], isDark: boolean) =>
  isDark ? colors.grey5 : colors.white;

interface ReaderBottomBarProps extends ReaderCornerMenuProps {
  visible: boolean;
  /** 0..1 through the article. */
  readingProgress: SharedValue<number>;
  /** Heading the reader is currently inside, when the article has an outline. */
  activeSectionLabel?: string | null;
}

/**
 * The reader's bottom chrome, revealed by tapping the page (like Apple Books):
 * where you are on the left, the corner menu on the right.
 *
 * Nothing here duplicates the top bar. The progress pill answers "how far
 * along, and in which section?" and doubles as the table-of-contents button when
 * the article has one; everything else lives in the corner menu so the resting
 * state is two small objects rather than a toolbar.
 */
export function ReaderBottomBar({
  visible,
  readingProgress,
  activeSectionLabel,
  ...menuProps
}: ReaderBottomBarProps) {
  const insets = useSafeAreaInsets();
  const isDark = useIsDarkMode();
  const [percent, setPercent] = useState(0);
  const shown = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    shown.value = withTiming(visible ? 1 : 0, { duration: CHROME_DURATION_MS });
  }, [visible, shown]);

  // Whole percent only: rounding before it crosses onto the JS thread caps this
  // at ~100 re-renders across an entire article instead of one per frame.
  useAnimatedReaction(
    () => Math.round(readingProgress.value * 100),
    (next, previous) => {
      if (next !== previous) runOnJS(setPercent)(next);
    }
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * CHROME_TRAVEL }],
  }));

  const { colors, onOpenOutline, onScrollToTop } = menuProps;
  const hasSection = !!activeSectionLabel;

  const handlePillPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // With an outline the pill is a table-of-contents button; without one the
    // only useful thing it can do is take you back to the top.
    if (onOpenOutline) onOpenOutline();
    else onScrollToTop();
  };

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[
        {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: insets.bottom > 0 ? insets.bottom : 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        },
        animatedStyle,
      ]}>
      <Pressable
        onPress={handlePillPress}
        accessibilityRole="button"
        accessibilityLabel={onOpenOutline ? 'Table of contents' : 'Scroll to top'}
        // Spoken as "42 percent, 12 of 100" rather than leaving the reading position to be
        // inferred from a ring VoiceOver cannot see.
        accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent}% read` }}
        className="flex-shrink flex-row items-center gap-2.5 rounded-full pl-2.5 pr-4"
        style={({ pressed }) => ({
          height: READER_CORNER_BUTTON_SIZE,
          backgroundColor: pillSurface(colors, isDark),
          // A full point, not a hairline: at 0.5px over a shadow the edge disappears on the
          // exact backgrounds this floats over.
          borderWidth: 1,
          borderColor: colors.grey4,
          opacity: pressed ? 0.75 : 1,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              // Dark mode gets a deeper, tighter shadow: a soft 8% shadow is invisible
              // against a near-black page, so the pill had nothing anchoring it.
              shadowOpacity: isDark ? 0.4 : 0.12,
              shadowRadius: isDark ? 10 : 14,
              shadowOffset: { width: 0, height: 4 },
            },
            android: { elevation: 6 },
          }),
        })}>
        <ReadingProgressRing
          progress={percent / 100}
          size={READER_PROGRESS_RING_SIZE}
          strokeWidth={READER_PROGRESS_RING_STROKE}
          color={colors.secondary}
          // `grey4` is a border token and vanishes into the lifted pill in both themes; `grey3`
          // is the first step that reads as an unfilled track rather than nothing.
          trackColor={colors.grey3}
        />
        {/* The percentage is the datum this control exists for, so it takes the foreground
            colour. It used to be `grey2` — about 1.9:1 on the old fill, under half of AA. */}
        <Text size={13} fontFamily="geist-semibold" style={{ color: colors.primary_foreground }}>
          {percent}%
        </Text>
        {hasSection && (
          <>
            <View style={{ width: 1, height: 16, backgroundColor: colors.grey4 }} />
            {/* Keyed so a new section fades in instead of snapping. */}
            <Animated.View
              key={activeSectionLabel}
              entering={FadeIn.duration(140)}
              style={{ flexShrink: 1 }}>
              <Text
                size={13}
                fontFamily="geist-medium"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ color: colors.grey }}>
                {activeSectionLabel}
              </Text>
            </Animated.View>
          </>
        )}
      </Pressable>

      <ReaderCornerMenu {...menuProps} />
    </Animated.View>
  );
}
