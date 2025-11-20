import { Radio } from '@components/ui/radio';
import { Text } from '@components/ui/text';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { COLORS } from '@lib/constants/colors';
import { useColorScheme } from 'nativewind';
import { forwardRef, useCallback, useState } from 'react';
import { View } from 'react-native';

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
    const { colorScheme } = useColorScheme();
    const colors = COLORS[colorScheme ?? 'light'];
    // Use the first language's value as default if initialLanguage is not provided
    const [selectedLanguage, setSelectedLanguage] = useState<string>(
      initialLanguage || languages[0]?.value || 'english'
    );

    const handleLanguageSelect = useCallback(
      (language: string) => {
        setSelectedLanguage(language);
        onLanguageChange?.(language);
        // Close the bottom sheet
        if (ref && typeof ref !== 'function' && ref.current) {
          ref.current.dismiss();
        }
      },
      [onLanguageChange, ref]
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} />
      ),
      []
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['50%']}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.white }}
        handleIndicatorStyle={{ backgroundColor: colors.muted_green }}>
        <BottomSheetScrollView
          className="flex-1 bg-white px-6 dark:bg-white-dark"
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}>
          <Text
            size="2xl"
            fontFamily="geist-bold"
            className="mb-6 tracking-heading text-black dark:text-black-dark">
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
