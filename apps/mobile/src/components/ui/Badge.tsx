import { cn } from '@/utils/cn';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { Text, View, type ViewProps } from 'react-native';

const badgeVariants = cva('rounded-full px-3 py-1 bg-mid-grey', {
    variants: {},
    defaultVariants: {},
});

const badgeTextVariants = cva('font-geist-semibold text-xs text-grey', {
    variants: {},
    defaultVariants: {},
});

export interface BadgeProps extends ViewProps {
    label: string;
    className?: string;
    textClassName?: string;
}

export const Badge = forwardRef<React.ElementRef<typeof View>, BadgeProps>(
    ({ label, className, textClassName, ...props }, ref) => {
        return (
            <View ref={ref} className={cn(badgeVariants(), className)} {...props}>
                <Text className={cn(badgeTextVariants(), textClassName)}>{label}</Text>
            </View>
        );
    }
);

Badge.displayName = 'Badge';
