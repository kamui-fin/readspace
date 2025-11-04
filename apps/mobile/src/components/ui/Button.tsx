import { cn } from '@/utils/cn';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

const buttonVariants = cva(
    'flex-row items-center justify-center rounded-full transition-opacity active:opacity-80',
    {
        variants: {
            variant: {
                primary: 'bg-primary dark:bg-primary',
                secondary: 'bg-mid-grey dark:bg-mid-grey-dark',
                black: 'bg-black dark:bg-black-dark',
                neutral: 'bg-mid-grey dark:bg-mid-grey-dark',
                outline:
                    'bg-transparent dark:bg-transparent border-2 border-black dark:border-black-dark',
            },
            size: {
                default: 'h-[52px] px-6',
                sm: 'h-11 px-4',
                lg: 'h-[58px] px-8',
                icon: 'h-12 w-12',
            },
            fullWidth: {
                true: 'w-full',
            },
            disabled: {
                true: 'opacity-50',
            },
        },
        defaultVariants: {
            variant: 'primary',
            size: 'default',
        },
    }
);

const buttonTextVariants = cva('font-geist-medium text-center', {
    variants: {
        variant: {
            primary: 'text-white dark:text-white',
            secondary: 'text-grey dark:text-grey-dark',
            black: 'text-white dark:text-black',
            neutral: 'text-black dark:text-black-dark',
            outline: 'text-black dark:text-black-dark',
        },
        size: {
            default: 'text-base',
            sm: 'text-sm',
            lg: 'text-lg',
            icon: 'text-base',
        },
    },
    defaultVariants: {
        variant: 'primary',
        size: 'default',
    },
});

export interface ButtonProps extends PressableProps, VariantProps<typeof buttonVariants> {
    children: React.ReactNode;
    className?: string;
    textClassName?: string;
    loading?: boolean;
}

export const Button = forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
    (
        {
            children,
            variant,
            size,
            fullWidth,
            disabled,
            className,
            textClassName,
            loading,
            ...props
        },
        ref
    ) => {
        const isDisabled = disabled || loading;

        return (
            <Pressable
                ref={ref}
                disabled={isDisabled}
                className={cn(
                    buttonVariants({ variant, size, fullWidth, disabled: isDisabled }),
                    className
                )}
                {...props}>
                {loading ? (
                    <ActivityIndicator
                        color={
                            variant === 'neutral' || variant === 'outline' ? '#232222' : '#FFFFFF'
                        }
                    />
                ) : typeof children === 'string' ? (
                    <Text className={cn(buttonTextVariants({ variant, size }), textClassName)}>
                        {children}
                    </Text>
                ) : (
                    children
                )}
            </Pressable>
        );
    }
);

Button.displayName = 'Button';
