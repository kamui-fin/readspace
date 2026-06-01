import LanguageIcon from '@components/icons/local/language';
import ArrowLeftLinearIcon from '@components/icons/solar/arrow-left-linear';
import CloseCircleBoldIcon from '@components/icons/solar/close-circle-bold';
import MagniferLinearIcon from '@components/icons/solar/magnifer-linear';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { forwardRef, useCallback } from 'react';
import {
  Platform,
  TextInput,
  type TextInputProps,
  TouchableOpacity,
  View,
  Keyboard,
} from 'react-native';

export type Language = 'english' | 'chinese' | 'japanese';

export interface SearchBarProps extends Omit<TextInputProps, 'onSubmitEditing' | 'ref'> {
  onLanguageChange?: (language: Language) => void;
  selectedLanguage?: Language;
  languagePickerRef?: React.RefObject<BottomSheetModal | null>;
  onClear?: () => void;
  onSubmit?: () => void;
  onCancel?: () => void;
  containerClassName?: string;
  /** True when the input is focused — switches left icon to back arrow */
  showCancelButton?: boolean;
  /** showClearButton is kept for API compat but clear is now shown automatically when value is non-empty */
  showClearButton?: boolean;
}

export const SearchBar = forwardRef<TextInput, SearchBarProps>(
  (
    {
      onLanguageChange,
      selectedLanguage = 'english',
      languagePickerRef,
      onClear,
      onSubmit,
      onCancel,
      containerClassName,
      showCancelButton = false,
      showClearButton = false,
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

    const isFocused = showCancelButton;
    const hasText = Boolean(value);

    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 9999,
          backgroundColor: isDark ? COLORS.dark.grey6 : COLORS.light.grey6,
        }}>
        {/* Left icon: back arrow when focused, magnifier when idle */}
        <TouchableOpacity
          onPress={isFocused ? onCancel : undefined}
          activeOpacity={isFocused ? 0.6 : 1}
          style={{ padding: 8, paddingLeft: 12 }}>
          {isFocused ? (
            <ArrowLeftLinearIcon width={20} height={20} color={colors.grey} strokeWidth={2.4} />
          ) : (
            <MagniferLinearIcon width={20} height={20} color={colors.grey} strokeWidth={2.4} />
          )}
        </TouchableOpacity>

        {/* Text input fills remaining space */}
        <TextInput
          ref={ref}
          style={[
            {
              flex: 1,
              fontFamily: 'Geist_500Medium',
              fontWeight: '500',
              fontSize: 16,
              color: isDark ? COLORS.dark.black : COLORS.light.black,
              paddingTop: Platform.select({ ios: 16, default: 12 }),
              paddingBottom: Platform.select({ ios: 16, default: 12 }),
            },
            // @ts-expect-error web outline
            Platform.select({ web: { outline: 'none' }, default: undefined }),
          ]}
          placeholder="What are you looking for?"
          placeholderTextColor={isDark ? COLORS.dark.grey2 : COLORS.light.grey2}
          value={value}
          onFocus={onFocus}
          onBlur={onBlur}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          selectionColor={isDark ? COLORS.dark.grey3 : COLORS.light.grey3}
          {...props}
        />

        {/* Right icon: clear X when typing, language picker when idle/focused-empty */}
        <View style={{ paddingRight: 8 }}>
          {hasText ? (
            <TouchableOpacity onPress={handleClear} style={{ padding: 8 }}>
              <CloseCircleBoldIcon width={20} height={20} color={colors.grey} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                languagePickerRef?.current?.present();
              }}
              style={{ padding: 8 }}>
              <LanguageIcon width={20} height={20} color={colors.black} fill="none" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }
);

SearchBar.displayName = 'SearchBar';
