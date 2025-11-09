import { cn } from '@/utils/cn';
import { Monicon } from '@monicon/native';
import { forwardRef } from 'react';
import { Pressable, type PressableProps } from 'react-native';

export interface CheckboxProps extends Omit<PressableProps, 'children'> {
    checked?: boolean;
    className?: string;
}

export const Checkbox = forwardRef<React.ElementRef<typeof Pressable>, CheckboxProps>(
    ({ checked = false, className, ...props }, ref) => {
        return (
            <Pressable
                ref={ref}
                className={cn(
                    'h-6 w-6 items-center justify-center rounded-full border-2 transition-opacity active:opacity-70',
                    checked
                        ? 'border-primary bg-primary dark:border-primary dark:bg-primary'
                        : 'border-green-grey bg-transparent dark:border-mid-grey-dark dark:bg-transparent',
                    className
                )}
                {...props}>
                {checked && <Monicon name="lucide:check" size={14} color="#FFFFFF" />}
            </Pressable>
        );
    }
);

Checkbox.displayName = 'Checkbox';
