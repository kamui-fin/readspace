import { Languages } from '@components/icons/svg';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { CloseCircleIcon } from '@solar-icons/react-native/bold';
import { ArrowLeftIcon, MagnifierIcon } from '@solar-icons/react-native/linear';
import { MotiView } from 'moti';
import { forwardRef, useCallback } from 'react';
import {
  Keyboard,
  Platform,
  TextInput,
  type TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';

export type Language = 'all' | 'english' | 'chinese' | 'japanese';

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
          style={{
            width: 44,
            height: 44,
            justifyContent: 'center',
            alignItems: 'center',
            marginLeft: 4,
          }}>
          <MotiView
            animate={{
              opacity: isFocused ? 0 : 1,
              scale: isFocused ? 0.9 : 1,
            }}
            transition={{ type: 'timing', duration: 180 }}
            style={{ position: 'absolute' }}>
            <MagnifierIcon size={20} color={colors.grey} strokeWidth={2.4} />
          </MotiView>

          <MotiView
            animate={{
              opacity: isFocused ? 1 : 0,
              scale: isFocused ? 1 : 0.9,
              translateX: isFocused ? 0 : -6,
            }}
            transition={{ type: 'timing', duration: 180 }}
            style={{ position: 'absolute' }}>
            <ArrowLeftIcon size={20} color={colors.grey} strokeWidth={2.4} />
          </MotiView>
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
              paddingLeft: 4,
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

        {/* Right icon: clear X when typing, language switcher when idle */}
        <View
          style={{
            width: 44,
            height: 44,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 4,
          }}>
          <MotiView
            animate={{ opacity: hasText ? 1 : 0, scale: hasText ? 1 : 0.9 }}
            transition={{ type: 'timing', duration: 180 }}
            style={{ position: 'absolute' }}
            pointerEvents={hasText ? 'auto' : 'none'}>
            <TouchableOpacity onPress={handleClear} activeOpacity={0.6} style={{ padding: 8 }}>
              <CloseCircleIcon size={20} color={colors.grey} />
            </TouchableOpacity>
          </MotiView>

          <MotiView
            animate={{ opacity: hasText ? 0 : 1, scale: hasText ? 0.9 : 1 }}
            transition={{ type: 'timing', duration: 180 }}
            style={{ position: 'absolute' }}
            pointerEvents={hasText ? 'none' : 'auto'}>
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                languagePickerRef?.current?.present();
              }}
              activeOpacity={0.6}
              style={{ padding: 8 }}>
              <Languages width={20} height={20} color={colors.grey} />
            </TouchableOpacity>
          </MotiView>
        </View>
      </View>
    );
  }
);

SearchBar.displayName = 'SearchBar';
