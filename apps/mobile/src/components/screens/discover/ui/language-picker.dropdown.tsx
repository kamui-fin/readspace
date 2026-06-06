import { Button } from '@components/ui/button';
import { Radio } from '@components/ui/radio';
import { Text } from '@components/ui/text';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { forwardRef, useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type Language = 'english' | 'chinese' | 'japanese';

export interface LanguageOption {
  value: string;
  label: string;
  countryCode?: string;
}

export interface LanguagePickerProps {
  onLanguageChange?: (language: string) => void;
  initialLanguage?: string;
  languages?: LanguageOption[];
  title?: string;
}

const DEFAULT_LANGUAGES: LanguageOption[] = [
  { value: 'english', label: 'English' },
  { value: 'chinese', label: '中文' },
  { value: 'japanese', label: '日本語' },
];

export const LanguagePicker = forwardRef<BottomSheetModal, LanguagePickerProps>(
  (
    { onLanguageChange, initialLanguage, languages = DEFAULT_LANGUAGES, title = 'Pick a language' },
    ref
  ) => {
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];
    const insets = useSafeAreaInsets();

    // Internal state for selection before confirming
    const [selectedLanguage, setSelectedLanguage] = useState<string | null>(
      initialLanguage || null
    );

    // Reset selection when bottom sheet is opened with a new string
    useEffect(() => {
      if (initialLanguage) {
        setSelectedLanguage(initialLanguage);
      }
    }, [initialLanguage]);

    const handleLanguageSelect = useCallback((language: string) => {
      setSelectedLanguage(language);
    }, []);

    const handleConfirm = useCallback(() => {
      if (selectedLanguage) {
        onLanguageChange?.(selectedLanguage);
        if (ref && typeof ref !== 'function' && ref.current) {
          ref.current.dismiss();
        }
      }
    }, [selectedLanguage, onLanguageChange, ref]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} />
      ),
      []
    );

    const renderFooter = useCallback(
      (props: any) => (
        <BottomSheetFooter {...props} bottomInset={0}>
          <View
            className="px-6 pt-4"
            style={{
              paddingBottom: Math.max(insets.bottom, 24),
              backgroundColor: colors.background,
            }}>
            <Button
              variant="primary"
              size="large"
              onPress={handleConfirm}
              disabled={!selectedLanguage}>
              Confirm
            </Button>
          </View>
        </BottomSheetFooter>
      ),
      [insets.bottom, handleConfirm, selectedLanguage, colors]
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['50%']}
        enableDynamicSizing={false}
        enablePanDownToClose
        footerComponent={renderFooter}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.background }}
        handleIndicatorStyle={{ backgroundColor: colors.grey4 }}>
        <BottomSheetScrollView
          className="bg-background flex-1 px-6"
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}>
          <Text size="2xl" fontFamily="geist-bold" className="tracking-heading mb-6 text-black">
            {title}
          </Text>

          <View className="flex-1 gap-3">
            {languages.map((language) => (
              <Radio
                key={language.value}
                label={language.label}
                selected={selectedLanguage === language.value}
                onPress={() => handleLanguageSelect(language.value)}
              />
            ))}
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);

LanguagePicker.displayName = 'LanguagePicker';
