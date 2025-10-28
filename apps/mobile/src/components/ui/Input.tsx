import { cn } from '@/utils/cn';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, useState } from 'react';
import {
    Text,
    TextInput as RNTextInput,
    View,
    type TextInputProps as RNTextInputProps,
} from 'react-native';

const inputVariants = cva(
    'w-full rounded-2xl bg-mid-grey dark:bg-mid-grey-dark px-5 py-4 font-geist text-base text-black dark:text-black-dark',
    {
        variants: {
            state: {
                default: 'border-0',
                focused: 'border-2 border-primary dark:border-primary',
                error: 'border-2 border-red dark:border-red',
            },
        },
        defaultVariants: {
            state: 'default',
        },
    }
);

export interface InputProps extends RNTextInputProps, VariantProps<typeof inputVariants> {
    label?: string;
    error?: string;
    containerClassName?: string;
    inputClassName?: string;
}

export const Input = forwardRef<React.ElementRef<typeof RNTextInput>, InputProps>(
    ({ label, error, state, containerClassName, inputClassName, ...props }, ref) => {
        const [isFocused, setIsFocused] = useState(false);

        const inputState = error ? 'error' : isFocused ? 'focused' : 'default';

        return (
            <View className={cn('w-full', containerClassName)}>
                {label && (
                    <Text className="mb-2 font-geist-medium text-sm text-black dark:text-black-dark">{label}</Text>
                )}
                <RNTextInput
                    ref={ref}
                    className={cn(inputVariants({ state: inputState }), inputClassName)}
                    placeholderTextColor="#90988B"
                    onFocus={(e) => {
                        setIsFocused(true);
                        props.onFocus?.(e);
                    }}
                    onBlur={(e) => {
                        setIsFocused(false);
                        props.onBlur?.(e);
                    }}
                    {...props}
                />
                {error && <Text className="mt-1 font-geist text-xs text-red dark:text-red">{error}</Text>}
            </View>
        );
    }
);

Input.displayName = 'Input';
