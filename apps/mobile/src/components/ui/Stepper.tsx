import { cn } from '@/utils/cn';
import { forwardRef } from 'react';
import { View, type ViewProps } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

export interface StepperProps extends ViewProps {
    totalSteps: number;
    currentStep: number; // 0-indexed
    className?: string;
}

export const Stepper = forwardRef<React.ElementRef<typeof View>, StepperProps>(
    ({ totalSteps, currentStep, className, ...props }, ref) => {
        const stepWidth = 100 / totalSteps;
        const position = currentStep * stepWidth;

        const animatedStyle = useAnimatedStyle(() => ({
            left: withTiming(`${position}%`, { duration: 300 }),
            width: `${stepWidth}%`,
        }));

        return (
            <View
                ref={ref}
                className={cn('relative h-1 overflow-hidden rounded-full bg-mid-grey', className)}
                {...props}>
                <Animated.View
                    className="absolute h-full rounded-full bg-secondary"
                    style={animatedStyle}
                />
            </View>
        );
    }
);

Stepper.displayName = 'Stepper';
