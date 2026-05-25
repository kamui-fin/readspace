import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';

const skeletonVariants = cva('bg-grey6 ', {
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
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (animate) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.5, {
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, {
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
          })
        ),
        -1,
        false
      );
    }
  }, [animate, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  const customStyle: Record<string, number | string> = {};
  if (width !== undefined) customStyle.width = width;
  if (height !== undefined) customStyle.height = height;

  return (
    <Animated.View
      className={clsx(skeletonVariants({ variant, size }), className)}
      style={[customStyle as object, animate ? animatedStyle : undefined, { backgroundColor: colors.grey5 }]}
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
      {/* biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static and don't reorder */}
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton
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
