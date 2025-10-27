import { Radio } from '@/components/ui/Radio';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

export type Language = 'english' | 'chinese' | 'japanese';

export interface LanguagePickerProps {
  onLanguageChange?: (language: Language) => void;
  initialLanguage?: Language;
}

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'english', label: 'English' },
  { value: 'chinese', label: '中文' },
  { value: 'japanese', label: '日本語' },
];

export const LanguagePicker = forwardRef<BottomSheet, LanguagePickerProps>(
  ({ onLanguageChange, initialLanguage = 'english' }, ref) => {
    const [selectedLanguage, setSelectedLanguage] = useState<Language>(initialLanguage);
    const snapPoints = useMemo(() => ['40%'], []);

    const handleLanguageSelect = useCallback(
      (language: Language) => {
        setSelectedLanguage(language);
        onLanguageChange?.(language);
        // Close the bottom sheet
        if (ref && typeof ref !== 'function' && ref.current) {
          ref.current.close();
        }
      },
      [onLanguageChange, ref]
    );

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} />
      ),
      []
    );

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: '#FFFFFF' }}
        handleIndicatorStyle={{ backgroundColor: '#D1DBCD' }}>
        <BottomSheetView className="flex-1 px-6">
          <Text className="mb-6 font-geist-bold text-2xl tracking-heading text-black">
            Pick a language
          </Text>
          <View className="gap-3">
            {LANGUAGES.map((language) => (
              <Radio
                key={language.value}
                label={language.label}
                selected={selectedLanguage === language.value}
                onPress={() => handleLanguageSelect(language.value)}
              />
            ))}
          </View>
        </BottomSheetView>
      </BottomSheet>
    );
  }
);

LanguagePicker.displayName = 'LanguagePicker';
