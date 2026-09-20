import { Text } from '@components/ui/text';
import { COLORS } from '@lib/constants/colors';
import { BookmarkIcon, LetterIcon, LetterOpenedIcon } from '@solar-icons/react-native/bold';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
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
const ICON_SIZE = 24;

interface SwipeableArticleRowProps {
  children: ReactNode;
  isRead: boolean;
  isSaved: boolean;
  /** Swipe right. Omit to disable (e.g. read state is hidden) */
  onToggleRead?: () => void;
  /** Swipe left */
  onToggleSaved: () => void;
}

interface ActionBackgroundProps {
  label: string;
  color: string;
  side: 'left' | 'right';
  icon: ReactNode;
  progress: SharedValue<number>;
}

/** Colored panel + icon/label revealed behind the row; icon pops once the trigger is crossed */
function ActionBackground({ label, color, side, icon, progress }: ActionBackgroundProps) {
  const isLeftSide = side === 'left';

  const panelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.15], [0, 1], Extrapolation.CLAMP),
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0.6, 1], [0.85, 1.1], Extrapolation.CLAMP) }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: color,
          justifyContent: 'center',
          alignItems: isLeftSide ? 'flex-start' : 'flex-end',
          paddingHorizontal: 24,
        },
        panelStyle,
      ]}>
      <Animated.View style={[{ alignItems: 'center', gap: 4 }, contentStyle]}>
        {icon}
        <Text size="xs" fontFamily="geist-semibold" style={{ color: COLORS.white }}>
          {label}
        </Text>
      </Animated.View>
    </Animated.View>
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
  const translateX = useSharedValue(0);
  const hasTriggeredHaptic = useSharedValue(false);
  const canSwipeRight = !!onToggleRead;

  const buzz = (style: Haptics.ImpactFeedbackStyle) => {
    Haptics.impactAsync(style);
  };

  const pan = usePanGesture({
    activeOffsetX: [-ACTIVATE_OFFSET_X, ACTIVATE_OFFSET_X],
    failOffsetY: [-FAIL_OFFSET_Y, FAIL_OFFSET_Y],
    onUpdate: (e) => {
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
    },
    onDeactivate: (e) => {
      const x = translateX.value;
      if (!e.canceled && Math.abs(x) >= TRIGGER_DISTANCE) {
        if (x > 0 && onToggleRead) {
          scheduleOnRN(onToggleRead);
        } else if (x < 0) {
          scheduleOnRN(onToggleSaved);
        }
      }
      hasTriggeredHaptic.value = false;
      translateX.value = withSpring(0, SNAP_BACK_SPRING);
    },
  });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  // 0 → 1 as the row travels toward the trigger distance, per direction
  const readProgress = useDerivedValue(() => Math.max(0, translateX.value) / TRIGGER_DISTANCE);
  const saveProgress = useDerivedValue(() => Math.max(0, -translateX.value) / TRIGGER_DISTANCE);

  const readColor = COLORS.light.primary;
  const saveColor = COLORS.light.blue;

  return (
    <View className="overflow-hidden">
      {canSwipeRight && (
        <ActionBackground
          side="left"
          color={readColor}
          label={isRead ? 'Unread' : 'Read'}
          progress={readProgress}
          icon={
            isRead ? (
              <LetterIcon size={ICON_SIZE} color={COLORS.white} />
            ) : (
              <LetterOpenedIcon size={ICON_SIZE} color={COLORS.white} />
            )
          }
        />
      )}
      <ActionBackground
        side="right"
        color={saveColor}
        label={isSaved ? 'Unsave' : 'Save'}
        progress={saveProgress}
        icon={<BookmarkIcon size={ICON_SIZE} color={COLORS.white} />}
      />

      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle} className="bg-background">
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
