import { cn } from '@/utils/cn';
import { forwardRef, useEffect } from 'react';
import { Pressable, type PressableProps, View } from 'react-native';
import Animated, {
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface SwitchProps extends Omit<PressableProps, 'children'> {
    value: boolean;
    onValueChange?: (value: boolean) => void;
    className?: string;
    duration?: number;
}

export const Switch = forwardRef<View, SwitchProps>(
    ({ value, onValueChange, className, duration = 200, ...props }, ref) => {
        const switchValue = useSharedValue(value ? 1 : 0);
        const height = useSharedValue(0);
        const width = useSharedValue(0);

        useEffect(() => {
            switchValue.value = value ? 1 : 0;
        }, [value, switchValue]);

        const trackStyle = useAnimatedStyle(() => {
            const color = interpolateColor(
                switchValue.value,
                [0, 1],
                ['#D1DBCD', '#6A994E'] // green-grey to secondary
            );
            const colorValue = withTiming(color, { duration });

            return {
                backgroundColor: colorValue,
                borderRadius: height.value / 2,
            };
        });

        const thumbStyle = useAnimatedStyle(() => {
            const moveValue = interpolate(
                Number(switchValue.value),
                [0, 1],
                [0, width.value - height.value]
            );
            const translateValue = withTiming(moveValue, { duration });

            return {
                transform: [{ translateX: translateValue }],
                borderRadius: height.value / 2,
            };
        });

        const handlePress = () => {
            onValueChange?.(!value);
        };

        return (
            <AnimatedPressable
                ref={ref}
                onPress={handlePress}
                onLayout={(e) => {
                    height.value = e.nativeEvent.layout.height;
                    width.value = e.nativeEvent.layout.width;
                }}
                className={cn('h-8 w-14 rounded-full p-1', className)}
                style={trackStyle}
                role="switch"
                accessibilityState={{ checked: value }}
                {...props}>
                <Animated.View
                    className="h-6 w-6 rounded-full bg-white dark:bg-white shadow-sm"
                    style={thumbStyle}
                />
            </AnimatedPressable>
        );
    }
);

Switch.displayName = 'Switch';
