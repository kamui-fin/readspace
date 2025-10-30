import { cn } from '@/utils/cn';
import { forwardRef } from 'react';
import { Pressable, Text, View, type PressableProps } from 'react-native';

export interface RadioProps extends Omit<PressableProps, 'children'> {
    label: string;
    selected?: boolean;
    className?: string;
    labelClassName?: string;
}

export const Radio = forwardRef<React.ElementRef<typeof Pressable>, RadioProps>(
    ({ label, selected, className, labelClassName, ...props }, ref) => {
        return (
            <Pressable
                ref={ref}
                className={cn(
                    'flex-row items-center gap-3 rounded-2xl bg-mid-grey dark:bg-mid-grey-dark px-5 py-4 transition-opacity active:opacity-80',
                    className
                )}
                {...props}>
                <View
                    className={cn(
                        'h-6 w-6 items-center justify-center rounded-full border-2 border-green-grey dark:border-grey-dark'
                    )}>
                    {selected && <View className="h-3 w-3 rounded-full bg-secondary dark:bg-secondary" />}
                </View>
                <Text className={cn('font-geist-medium text-base text-black dark:text-black-dark', labelClassName)}>
                    {label}
                </Text>
            </Pressable>
        );
    }
);

Radio.displayName = 'Radio';
