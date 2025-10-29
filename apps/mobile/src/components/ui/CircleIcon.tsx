import { cn } from '@/utils/cn';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';

const circleIconVariants = cva('items-center justify-center rounded-full', {
    variants: {
        variant: {
            static: 'bg-light-grey dark:bg-light-grey-dark',
            clickable: 'bg-light-grey dark:bg-light-grey-dark transition-opacity active:opacity-60',
        },
        size: {
            default: 'h-12 w-12',
            sm: 'h-10 w-10',
            lg: 'h-14 w-14',
        },
    },
    defaultVariants: {
        variant: 'static',
        size: 'default',
    },
});

type BaseCircleIconProps = {
    children: React.ReactNode;
    className?: string;
};

type StaticCircleIconProps = BaseCircleIconProps &
    ViewProps &
    VariantProps<typeof circleIconVariants> & {
        variant?: 'static';
        onPress?: never;
    };

type ClickableCircleIconProps = BaseCircleIconProps &
    PressableProps &
    VariantProps<typeof circleIconVariants> & {
        variant: 'clickable';
        onPress: () => void;
    };

export type CircleIconProps = StaticCircleIconProps | ClickableCircleIconProps;

export const CircleIcon = forwardRef<
    React.ElementRef<typeof View> | React.ElementRef<typeof Pressable>,
    CircleIconProps
>(({ children, variant = 'static', size, className, ...props }, ref) => {
    if (variant === 'clickable') {
        const { onPress, ...pressableProps } = props as ClickableCircleIconProps;
        return (
            <Pressable
                ref={ref as React.Ref<React.ElementRef<typeof Pressable>>}
                onPress={onPress}
                className={cn(circleIconVariants({ variant, size }), className)}
                {...pressableProps}>
                {children}
            </Pressable>
        );
    }

    return (
        <View
            ref={ref as React.Ref<React.ElementRef<typeof View>>}
            className={cn(circleIconVariants({ variant, size }), className)}
            {...(props as ViewProps)}>
            {children}
        </View>
    );
});

CircleIcon.displayName = 'CircleIcon';
