import { cn } from '@/utils/cn';
import { forwardRef } from 'react';
import { View, type ViewProps } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

export interface ProgressBarProps extends ViewProps {
    percentage: number; // 0-100
    className?: string;
}

export const ProgressBar = forwardRef<React.ElementRef<typeof View>, ProgressBarProps>(
    ({ percentage, className, ...props }, ref) => {
        const clampedPercentage = Math.min(Math.max(percentage, 0), 100);

        const animatedStyle = useAnimatedStyle(() => ({
            width: withTiming(`${clampedPercentage}%`, { duration: 300 }),
        }));

        return (
            <View
                ref={ref}
                className={cn('h-1 overflow-hidden rounded-full bg-green-grey', className)}
                {...props}>
                <Animated.View className="h-full rounded-full bg-secondary" style={animatedStyle} />
            </View>
        );
    }
);

ProgressBar.displayName = 'ProgressBar';
