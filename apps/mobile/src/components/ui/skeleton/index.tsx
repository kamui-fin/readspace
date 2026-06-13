import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  makeMutable,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const skeletonVariants = cva('', {
  variants: {
    variant: {
      rectangle: 'rounded-lg',
      circle: 'rounded-full',
      text: 'rounded-md',
    },
    size: {
      small: 'h-4 w-20',
      medium: 'h-6 w-32',
      large: 'h-8 w-48',
    },
  },
  defaultVariants: {
    variant: 'rectangle',
  },
});

export interface SkeletonProps extends VariantProps<typeof skeletonVariants> {
  className?: string;
  width?: number | string;
  height?: number | string;
  animate?: boolean;
}

// A single static mutable value shared by all skeletons across the app.
// This runs exactly one animation loop on the UI thread, preventing CPU flooding
// and ensuring all skeleton elements pulse in perfect sync.
const globalSkeletonOpacity = makeMutable(1);
let activeSkeletonCount = 0;

export function Skeleton({
  variant,
  size,
  className,
  width,
  height,
  animate = true,
}: SkeletonProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  useEffect(() => {
    if (!animate) return;

    activeSkeletonCount++;
    if (activeSkeletonCount === 1) {
      // Start the single global loop on the UI thread
      globalSkeletonOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, {
            duration: 850,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, {
            duration: 850,
            easing: Easing.inOut(Easing.ease),
          })
        ),
        -1,
        false
      );
    }

    return () => {
      activeSkeletonCount--;
      if (activeSkeletonCount === 0) {
        // Last skeleton unmounted: stop the animation loop to conserve battery
        cancelAnimation(globalSkeletonOpacity);
        globalSkeletonOpacity.value = 1;
      }
    };
  }, [animate]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: globalSkeletonOpacity.value,
    };
  });

  const customStyle: Record<string, number | string> = {};
  if (width !== undefined) customStyle.width = width;
  if (height !== undefined) customStyle.height = height;

  return (
    <Animated.View
      className={clsx(skeletonVariants({ variant, size }), className)}
      style={[
        customStyle as object,
        animate ? animatedStyle : undefined,
        { backgroundColor: isDark ? colors.grey4 : colors.grey5 },
      ]}
    />
  );
}

// Convenience component for creating multiple skeleton lines
export interface SkeletonGroupProps {
  count?: number;
  spacing?: number;
  className?: string;
  itemClassName?: string;
  variant?: SkeletonProps['variant'];
  size?: SkeletonProps['size'];
  animate?: boolean;
}

export function SkeletonGroup({
  count = 3,
  spacing = 12,
  className,
  itemClassName,
  variant,
  size,
  animate = true,
}: SkeletonGroupProps) {
  return (
    <View className={clsx('flex-col', className)} style={{ gap: spacing }}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton
          // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static
          key={`skeleton-${index}`}
          variant={variant}
          size={size}
          className={itemClassName}
          animate={animate}
        />
      ))}
    </View>
  );
}
