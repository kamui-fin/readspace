import { cn } from '@/utils/cn';
import { Monicon } from '@monicon/native';
import { forwardRef, useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

export interface SearchBarProps extends Omit<TextInputProps, 'onSubmitEditing'> {
    onLanguagePress?: () => void;
    onClear?: () => void;
    onSubmit?: () => void;
    onCancel?: () => void;
    containerClassName?: string;
    showClearButton?: boolean;
    showCancelButton?: boolean;
}

export const SearchBar = forwardRef<TextInput, SearchBarProps>(
    (
        {
            onLanguagePress,
            onClear,
            onSubmit,
            onCancel,
            containerClassName,
            showClearButton = false,
            showCancelButton = false,
            value,
            ...props
        },
        ref
    ) => {
        const [isFocused, setIsFocused] = useState(false);

        const handleClear = () => {
            onClear?.();
        };

        const handleSubmit = () => {
            if (value) {
                onSubmit?.();
            }
        };

        return (
            <View className="flex-row items-center gap-3">
                <View
                    className={cn(
                        'flex-1 flex-row items-center gap-3 rounded-2xl bg-mid-grey dark:bg-mid-grey-dark px-4 py-1',
                        isFocused && 'border-2 border-primary dark:border-primary',
                        containerClassName
                    )}>
                    {/* Search Icon (decorative) */}
                    <Monicon name="solar:magnifer-linear" size={20} color="#90988B" />

                    {/* Text Input */}
                    <TextInput
                        ref={ref}
                        className="flex-1 font-geist text-base text-black dark:text-black-dark"
                        placeholderTextColor="#90988B"
                        value={value}
                        onFocus={(e) => {
                            setIsFocused(true);
                            props.onFocus?.(e);
                        }}
                        onBlur={(e) => {
                            setIsFocused(false);
                            props.onBlur?.(e);
                        }}
                        onSubmitEditing={() => handleSubmit()}
                        returnKeyType="search"
                        {...props}
                    />

                    {/* Clear Button (conditional) */}
                    {showClearButton && value && (
                        <Pressable
                            onPress={handleClear}
                            className="transition-opacity active:opacity-60"
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Monicon name="solar:close-circle-bold" size={20} color="#90988B" />
                        </Pressable>
                    )}

                    {/* Language Button (hide when cancel is shown) */}
                    {!showCancelButton && (
                        <Pressable
                            onPress={onLanguagePress}
                            className="transition-opacity active:opacity-60"
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Monicon name="lucide:languages" size={20} color="#90988B" />
                        </Pressable>
                    )}
                </View>

                {/* Cancel Button (conditional) */}
                {showCancelButton && (
                    <Pressable
                        onPress={onCancel}
                        className="transition-opacity active:opacity-60"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text className="font-geist text-base text-grey dark:text-grey-dark">Cancel</Text>
                    </Pressable>
                )}
            </View>
        );
    }
);

SearchBar.displayName = 'SearchBar';
