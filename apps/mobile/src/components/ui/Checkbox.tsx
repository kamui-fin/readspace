import { cn } from '@/utils/cn';
import { Monicon } from '@monicon/native';
import { forwardRef } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

export interface CheckboxProps extends Omit<PressableProps, 'children'> {
    checked?: boolean;
    className?: string;
}

const AnimatedMonicon = Animated.createAnimatedComponent(Monicon);

export const Checkbox = forwardRef<React.ElementRef<typeof Pressable>, CheckboxProps>(
    ({ checked = false, className, ...props }, ref) => {
        const animatedStyle = useAnimatedStyle(() => {
            return {
                transform: [
                    { scale: withSpring(checked ? 1 : 0.8, { damping: 15, stiffness: 150 }) },
                ],
                opacity: withSpring(checked ? 1 : 0, { damping: 15, stiffness: 150 }),
            };
        });

        return (
            <Pressable
                ref={ref}
                className={cn(
                    'h-6 w-6 items-center justify-center rounded-full border-2 transition-opacity active:opacity-70',
                    checked ? 'border-primary dark:border-primary bg-primary dark:bg-primary' : 'border-green-grey dark:border-mid-grey-dark bg-transparent dark:bg-transparent',
                    className
                )}
                {...props}>
                <AnimatedMonicon name="lucide:check" size={14} color="#FFFFFF" style={animatedStyle} />
            </Pressable>
        );
    }
);

Checkbox.displayName = 'Checkbox';
