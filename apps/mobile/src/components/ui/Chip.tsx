import { cn } from '@/utils/cn';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { Pressable, Text, type PressableProps } from 'react-native';

const chipVariants = cva('rounded-full px-8 py-3 transition-opacity active:opacity-80', {
    variants: {
        variant: {
            default: 'bg-mid-grey',
            selected: 'bg-secondary',
        },
    },
    defaultVariants: {
        variant: 'default',
    },
});

const chipTextVariants = cva('font-geist-medium text-sm', {
    variants: {
        variant: {
            default: 'text-grey',
            selected: 'text-white',
        },
    },
    defaultVariants: {
        variant: 'default',
    },
});

export interface ChipProps extends PressableProps, VariantProps<typeof chipVariants> {
    label: string;
    selected?: boolean;
    className?: string;
    textClassName?: string;
}

export const Chip = forwardRef<React.ElementRef<typeof Pressable>, ChipProps>(
    ({ label, selected, variant, className, textClassName, ...props }, ref) => {
        const chipVariant = selected ? 'selected' : variant || 'default';

        return (
            <Pressable
                ref={ref}
                className={cn(chipVariants({ variant: chipVariant }), className)}
                {...props}>
                <Text className={cn(chipTextVariants({ variant: chipVariant }), textClassName)}>
                    {label}
                </Text>
            </Pressable>
        );
    }
);

Chip.displayName = 'Chip';
