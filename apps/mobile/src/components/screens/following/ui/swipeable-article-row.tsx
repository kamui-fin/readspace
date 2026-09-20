import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { BookmarkIcon, LetterIcon, LetterOpenedIcon } from '@solar-icons/react-native/bold';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** Distance (pt) the row must travel before releasing triggers the action */
const TRIGGER_DISTANCE = 96;
/** Horizontal travel before the pan claims the touch; keeps taps + vertical scroll working */
const ACTIVATE_OFFSET_X = 12;
/** Vertical travel that fails the pan so list scrolling wins */
const FAIL_OFFSET_Y = 10;
/** Rubber-band factor applied past the trigger distance */
const OVERSHOOT_RESISTANCE = 0.35;
const SNAP_BACK_SPRING = { damping: 26, stiffness: 320, mass: 0.6 } as const;

/** Saved is yellow app-wide — the reader's bookmark button uses the same value. */
const SAVE_YELLOW = '#FBBC04';

const ICON_SIZE = 20;
/** Diameter of the badge that rides under the row. */
const BADGE_SIZE = 36;
/** Gap between the badge and the screen edge it emerges from. */
const BADGE_INSET = 18;
/** Badge is fully solid by this fraction of the trigger distance. */
const BADGE_FILL_AT = 0.85;
/**
 * Width of the lane each badge sits in. Fixed, never animated: the badge is revealed by the row
 * sliding off it, not by the lane growing, so nothing about this layer touches Yoga mid-gesture.
 */
const LANE_WIDTH = TRIGGER_DISTANCE;

interface SwipeableArticleRowProps {
  children: ReactNode;
  isRead: boolean;
  isSaved: boolean;
  /** Swipe right. Omit to disable (e.g. read state is hidden) */
  onToggleRead?: () => void;
  /** Swipe left */
  onToggleSaved: () => void;
}

interface SwipeActionProps {
  side: 'left' | 'right';
  /** Live row offset; the badge is driven straight off it. */
  translateX: SharedValue<number>;
  /** Accent for this action — yellow to save, green to mark read. */
  color: string;
  /** The resting, barely-there wash behind the badge. */
  trackColor: string;
  icon: (color: string) => ReactNode;
  label: string;
}

/**
 * One swipe action: a fixed-width lane parked under the row with a single round badge in it.
 *
 * Nothing here is painted except the badge, and the badge's *static* opacity is 0 — the animation
 * is the only thing that can ever make it visible. An earlier version drew a tinted strip whose
 * width came from the animated style alone; an absolutely-positioned view with no static width
 * sizes to its content, so every row in the list showed a green and a yellow rectangle at rest.
 *
 * Deliberately not a full-bleed coloured panel either: a row recolouring end to end mid-drag
 * reads as the list breaking rather than as one action being offered.
 */
function SwipeAction({ side, translateX, color, trackColor, icon, label }: SwipeActionProps) {
  const isLeft = side === 'left';

  // Travel in this direction only; the other direction leaves this badge hidden.
  const distance = (x: number) => {
    'worklet';
    return Math.max(0, isLeft ? x : -x);
  };

  const badgeStyle = useAnimatedStyle(() => {
    const progress = distance(translateX.value) / TRIGGER_DISTANCE;
    return {
      opacity: interpolate(progress, [0.08, 0.32], [0, 1], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(progress, [0.32, BADGE_FILL_AT], [0.7, 1], Extrapolation.CLAMP) },
      ],
      backgroundColor: interpolateColor(
        Math.min(progress, 1),
        [BADGE_FILL_AT - 0.35, BADGE_FILL_AT],
        [trackColor, color]
      ),
    };
  });

  const glyphStyle = useAnimatedStyle(() => {
    const progress = distance(translateX.value) / TRIGGER_DISTANCE;
    return {
      opacity: interpolate(
        progress,
        [BADGE_FILL_AT - 0.35, BADGE_FILL_AT],
        [1, 0],
        Extrapolation.CLAMP
      ),
    };
  });

  const armedGlyphStyle = useAnimatedStyle(() => {
    const progress = distance(translateX.value) / TRIGGER_DISTANCE;
    return {
      opacity: interpolate(
        progress,
        [BADGE_FILL_AT - 0.35, BADGE_FILL_AT],
        [0, 1],
        Extrapolation.CLAMP
      ),
    };
  });

  return (
    <View
      pointerEvents="none"
      accessibilityLabel={label}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: isLeft ? 0 : undefined,
        right: isLeft ? undefined : 0,
        width: LANE_WIDTH,
        justifyContent: 'center',
        alignItems: isLeft ? 'flex-start' : 'flex-end',
        paddingHorizontal: BADGE_INSET,
      }}>
      <Animated.View
        style={[
          {
            width: BADGE_SIZE,
            height: BADGE_SIZE,
            borderRadius: BADGE_SIZE / 2,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
          },
          badgeStyle,
        ]}>
        {/* Two stacked glyphs cross-fade: tinted while the action is merely offered, white once
            releasing would actually fire it. A single glyph can't animate its colour prop. */}
        <Animated.View style={[{ position: 'absolute' }, glyphStyle]}>{icon(color)}</Animated.View>
        <Animated.View style={[{ position: 'absolute' }, armedGlyphStyle]}>
          {icon(COLORS.white)}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/**
 * Gmail / Outlook-style swipe actions for an article row.
 * Swipe right → toggle read, swipe left → toggle saved. Releasing past
 * `TRIGGER_DISTANCE` fires the action and the row springs back (the list
 * updates optimistically, so the row stays in place).
 */
export function SwipeableArticleRow({
  children,
  isRead,
  isSaved,
  onToggleRead,
  onToggleSaved,
}: SwipeableArticleRowProps) {
  const { width } = useWindowDimensions();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const translateX = useSharedValue(0);
  const hasTriggeredHaptic = useSharedValue(false);
  const canSwipeRight = !!onToggleRead;

  const buzz = (style: Haptics.ImpactFeedbackStyle) => {
    Haptics.impactAsync(style);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-ACTIVATE_OFFSET_X, ACTIVATE_OFFSET_X])
    .failOffsetY([-FAIL_OFFSET_Y, FAIL_OFFSET_Y])
    .onUpdate((e) => {
      const raw = e.translationX;
      const clamped = !canSwipeRight && raw > 0 ? 0 : raw;
      const distance = Math.abs(clamped);
      // Rubber-band beyond the trigger, and never drag past the screen edge
      const eased =
        distance <= TRIGGER_DISTANCE
          ? distance
          : Math.min(
              TRIGGER_DISTANCE + (distance - TRIGGER_DISTANCE) * OVERSHOOT_RESISTANCE,
              width
            );
      translateX.value = Math.sign(clamped) * eased;

      const crossed = eased >= TRIGGER_DISTANCE;
      if (crossed && !hasTriggeredHaptic.value) {
        hasTriggeredHaptic.value = true;
        scheduleOnRN(buzz, Haptics.ImpactFeedbackStyle.Medium);
      } else if (!crossed && hasTriggeredHaptic.value) {
        hasTriggeredHaptic.value = false;
        scheduleOnRN(buzz, Haptics.ImpactFeedbackStyle.Light);
      }
    })
    .onEnd((_e, success) => {
      const x = translateX.value;
      if (success && Math.abs(x) >= TRIGGER_DISTANCE) {
        if (x > 0 && onToggleRead) {
          scheduleOnRN(onToggleRead);
        } else if (x < 0) {
          scheduleOnRN(onToggleSaved);
        }
      }
    })
    .onFinalize(() => {
      hasTriggeredHaptic.value = false;
      translateX.value = withSpring(0, SNAP_BACK_SPRING);
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  return (
    <View className="overflow-hidden">
      {canSwipeRight && (
        <SwipeAction
          side="left"
          translateX={translateX}
          color={colors.secondary}
          trackColor={colors.icon_bg_green}
          label={isRead ? 'Mark as unread' : 'Mark as read'}
          icon={(color) =>
            isRead ? (
              <LetterIcon size={ICON_SIZE} color={color} />
            ) : (
              <LetterOpenedIcon size={ICON_SIZE} color={color} />
            )
          }
        />
      )}
      <SwipeAction
        side="right"
        translateX={translateX}
        color={SAVE_YELLOW}
        trackColor={colors.icon_bg_yellow}
        label={isSaved ? 'Unsave' : 'Save'}
        icon={(color) => <BookmarkIcon size={ICON_SIZE} color={color} />}
      />

      <GestureDetector gesture={pan}>
        {/* Opaque on purpose: this is what hides both badges until the row actually moves. */}
        <Animated.View style={rowStyle} className="bg-background">
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
