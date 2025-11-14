import { type ComponentProps, forwardRef, useState, type ReactNode } from 'react';
import {
  TextInput as ReactNativeTextInput,
  NativeSyntheticEvent,
  TextInputKeyPressEvent,
  View,
} from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';

import { COLORS } from '@lib/constants/colors';
import { useIsDarkMode } from '@hooks/useIsDarkMode';

const inputVariants = cva(
  'font-geist-regular text-base px-4 py-3 rounded-xl border-2 transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-white dark:bg-background-dark',
        filled: 'bg-grey6 dark:bg-grey6-dark',
        withRightIcons: 'bg-grey5 dark:bg-grey5-dark pr-0',
      },
      size: {
        small: 'px-3 py-2 text-sm',
        medium: 'px-4 py-3 text-base',
        large: 'px-4 py-3 text-lg',
      },
      disabled: {
        true: 'opacity-50',
        false: '',
      },
      rightIconCount: {
        0: '',
        1: 'pr-0',
        2: 'pr-0',
      },
    },
    compoundVariants: [
      {
        variant: 'withRightIcons',
        rightIconCount: 1,
        class: 'pr-0',
      },
      {
        variant: 'withRightIcons',
        rightIconCount: 2,
        class: 'pr-0',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'medium',
      disabled: false,
      rightIconCount: 0,
    },
  }
);

export type TextInputProps = {
  className?: string;
  error?: boolean;
  leftIconButton?: ReactNode;
  rightIconButtons?: ReactNode[];
} & Omit<ComponentProps<typeof ReactNativeTextInput>, 'className'> &
  VariantProps<typeof inputVariants>;

const TextInput = forwardRef<ReactNativeTextInput, TextInputProps>(
  (
    {
      className,
      variant,
      size,
      error = false,
      disabled = false,
      leftIconButton,
      rightIconButtons,
      onFocus,
      onBlur,
      ...restProps
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const isDark = useIsDarkMode();

    // Determine right icon count (max 2)
    const iconCount: 0 | 1 | 2 = rightIconButtons
      ? (Math.min(rightIconButtons.length, 2) as 0 | 1 | 2)
      : 0;

    // biome-ignore lint/suspicious/noExplicitAny: false positive
    const handleFocus = (e: any) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    // biome-ignore lint/suspicious/noExplicitAny: false positive
    const handleBlur = (e: any) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const getBorderColor = () => {
      if (error) return isDark ? COLORS.dark.destructive : COLORS.light.destructive;
      if (isFocused) return isDark ? COLORS.dark.primary : COLORS.light.primary;
      return isDark ? COLORS.dark.grey4 : COLORS.light.grey4;
    };

    const getTextColor = () =>
      isDark ? COLORS.dark.primary_foreground : COLORS.light.primary_foreground;

    const getPlaceholderColor = () => (isDark ? COLORS.dark.grey : COLORS.light.grey);

    const getInputStyles = () => {
      if (restProps.multiline) {
        return {
          includeFontPadding: false,
          textAlignVertical: 'top' as const,
        };
      }

      // For single-line inputs, set fixed height and center vertically
      const sizeConfig = {
        small: 40,
        medium: 48,
        large: 56,
      };

      const height = sizeConfig[size || 'medium'];

      return {
        includeFontPadding: false,
        height,
        textAlignVertical: 'center' as const,
      };
    };

    // If variant is withRightIcons, wrap in container
    if (variant === 'withRightIcons') {
      return (
        <View
          className={clsx(
            'flex-row items-center rounded-xl border-2',
            variant === 'withRightIcons' &&
              (isFocused ? 'border-primary dark:border-primary' : 'border-transparent')
          )}
          style={{
            backgroundColor: isFocused
              ? isDark
                ? COLORS.dark.grey6
                : COLORS.light.grey6
              : isDark
                ? COLORS.dark.grey5
                : COLORS.light.grey5,
          }}>
          {/* Left Icon Button */}
          {leftIconButton && <View className="pl-1">{leftIconButton}</View>}
          <ReactNativeTextInput
            ref={ref}
            {...restProps}
            className={clsx(
              'flex-1 border-0 bg-transparent text-left font-geist-regular',
              size === 'small' && 'px-2 py-2 text-sm',
              size === 'medium' && 'px-3 py-3 text-base',
              size === 'large' && 'px-3 py-3 text-lg',
              leftIconButton && 'pl-2',
              disabled && 'opacity-50',
              className
            )}
            style={{
              color: getTextColor(),
              ...getInputStyles(),
            }}
            placeholderTextColor={getPlaceholderColor()}
            editable={!disabled}
            multiline={restProps.multiline ?? false}
            autoCorrect={restProps.secureTextEntry ? false : restProps.autoCorrect}
            autoCapitalize={restProps.secureTextEntry ? 'none' : restProps.autoCapitalize}
            textContentType={restProps.secureTextEntry ? 'password' : restProps.textContentType}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
          {/* Right Icon Buttons */}
          {iconCount > 0 && (
            <View className="flex-row items-center gap-2 pr-2.5">
              {rightIconButtons?.slice(0, 2).map((icon, index) => (
                <View key={`right-icon-${index.toString()}`}>{icon}</View>
              ))}
            </View>
          )}
        </View>
      );
    }

    return (
      <ReactNativeTextInput
        ref={ref}
        {...restProps}
        className={clsx(
          inputVariants({ variant, size, disabled, rightIconCount: iconCount }),
          className
        )}
        style={{
          borderColor: getBorderColor(),
          color: getTextColor(),
          textAlign: restProps.secureTextEntry
            ? 'left'
            : restProps.multiline
              ? undefined
              : 'center',
          ...getInputStyles(),
        }}
        placeholderTextColor={getPlaceholderColor()}
        editable={!disabled}
        multiline={restProps.multiline ?? false}
        autoCorrect={restProps.secureTextEntry ? false : restProps.autoCorrect}
        autoCapitalize={restProps.secureTextEntry ? 'none' : restProps.autoCapitalize}
        textContentType={restProps.secureTextEntry ? 'password' : restProps.textContentType}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  }
);

TextInput.displayName = 'TextInput';

export { TextInput, NativeSyntheticEvent, TextInputKeyPressEvent };
