import { forwardRef, useMemo, useCallback } from 'react';
import type { TextInputProps } from 'react-native';
import { View } from 'react-native';
import { Monicon } from '@monicon/native';
import { Input } from '@components/ui/input';
import { Button } from '@components/ui/button';
import { LanguageIcon } from '@components/icons/language';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemTitle,
} from '@components/ui/dropdown-menu';
import { COLORS } from '@lib/constants/colors';
import { useIsDarkMode } from '@hooks/useIsDarkMode';

export type Language = 'english' | 'chinese' | 'japanese';

const LANGUAGES = [
  { value: 'english' as Language, label: 'English' },
  { value: 'chinese' as Language, label: '中文' },
  { value: 'japanese' as Language, label: '日本語' },
];

export interface SearchBarProps extends Omit<TextInputProps, 'onSubmitEditing' | 'ref'> {
  onLanguageChange?: (language: Language) => void;
  selectedLanguage?: Language;
  onClear?: () => void;
  onSubmit?: () => void;
  onCancel?: () => void;
  containerClassName?: string;
  showClearButton?: boolean;
  showCancelButton?: boolean;
}

export const SearchBar = forwardRef<React.ElementRef<typeof Input>, SearchBarProps>(
  (
    {
      onLanguageChange,
      selectedLanguage = 'english',
      onClear,
      onSubmit,
      onCancel,
      containerClassName,
      showClearButton = false,
      showCancelButton = false,
      value,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];

    const handleClear = useCallback(() => {
      onClear?.();
    }, [onClear]);

    const handleSubmit = useCallback(() => {
      if (value) {
        onSubmit?.();
      }
    }, [value, onSubmit]);

    const handleLanguageSelect = useCallback(
      (language: Language) => {
        onLanguageChange?.(language);
      },
      [onLanguageChange]
    );

    // Build right element with icon buttons (max 2)
    const rightElement = useMemo(() => {
      const buttons: React.ReactNode[] = [];

      // Clear button (if shown and has value)
      if (showClearButton && value) {
        buttons.push(
          <Button
            key="clear"
            variant="text"
            size="small"
            fullWidth={false}
            onPress={handleClear}
            className="min-w-0">
            <Monicon name="solar:close-circle-bold" size={20} color={colors.grey} />
          </Button>
        );
      }

      // Search icon button (rounded square with lighter primary background)
      buttons.push(
        <Button
          key="search"
          variant="secondary"
          size="medium"
          fullWidth={false}
          onPress={handleSubmit}
          disabled={!value}
          className="min-w-0"
          style={{
            borderRadius: 8,
            backgroundColor: colors.primary,
          }}>
          <Monicon name="solar:magnifer-linear" size={20} color={colors.white} strokeWidth={2.4} />
        </Button>
      );

      return buttons.length > 0 ? (
        <View className="flex-row items-center gap-2 pr-2.5">{buttons}</View>
      ) : undefined;
    }, [
      showClearButton,
      value,
      handleClear,
      handleSubmit,
      colors.grey,
      colors.primary,
      colors.white,
    ]);

    // biome-ignore lint/suspicious/noExplicitAny: TextInput event types are complex
    const handleFocus = (e: any) => {
      onFocus?.(e);
    };

    // biome-ignore lint/suspicious/noExplicitAny: TextInput event types are complex
    const handleBlur = (e: any) => {
      onBlur?.(e);
    };

    const leftElement = (
      <DropdownMenuRoot>
        <DropdownMenuTrigger>
          <Button
            variant="text"
            size="small"
            fullWidth={false}
            className="min-w-0 flex-row items-center gap-1">
            <LanguageIcon size={20} color={colors.grey} />
            <Monicon
              name="solar:alt-arrow-down-linear"
              size={12}
              strokeWidth={2.8}
              color={colors.grey}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {LANGUAGES.map((lang) => (
            <DropdownMenuItem key={lang.value} onSelect={() => handleLanguageSelect(lang.value)}>
              <DropdownMenuItemTitle>{lang.label}</DropdownMenuItemTitle>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenuRoot>
    );

    return (
      <Input
        ref={ref}
        className="w-full"
        placeholder="What are you looking for?"
        value={value}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onSubmitEditing={() => handleSubmit()}
        returnKeyType="search"
        inputStyle={{
          textAlignVertical: 'center',
          textAlign: 'center',
        }}
        leftElement={leftElement}
        rightElement={rightElement}
        {...props}
      />
    );
  }
);

SearchBar.displayName = 'SearchBar';
