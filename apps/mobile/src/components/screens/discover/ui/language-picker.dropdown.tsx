import { BottomSheet, type SheetRef } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { Radio } from '@components/ui/radio';
import { forwardRef, useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

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

/**
 * Default language options — kept intentionally small (matches web's
 * DISCOVER_LANGUAGES). Callers that need a different set (e.g. article
 * translation) pass their own `languages` prop.
 */
const DEFAULT_LANGUAGES: LanguageOption[] = [
  { value: 'english', label: 'English' },
  { value: 'chinese', label: '中文' },
];

export const LanguagePicker = forwardRef<SheetRef, LanguagePickerProps>(
  (
    { onLanguageChange, initialLanguage, languages = DEFAULT_LANGUAGES, title = 'Pick a language' },
    ref
  ) => {
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

    const handleConfirm = useCallback(() => {
      if (selectedLanguage) {
        onLanguageChange?.(selectedLanguage);
        if (ref && typeof ref !== 'function') {
          ref.current?.dismiss();
        }
      }
    }, [selectedLanguage, onLanguageChange, ref]);

    return (
      <BottomSheet
        ref={ref}
        snapPoints={['50%']}
        headerTitle={title}
        headerTitleAlign="left"
        footerActions={
          <Button
            variant="primary"
            size="large"
            onPress={handleConfirm}
            disabled={!selectedLanguage}>
            Confirm
          </Button>
        }>
        <View className="gap-3">
          {languages.map((language) => (
            <Radio
              key={language.value}
              label={language.label}
              selected={selectedLanguage === language.value}
              onPress={() => setSelectedLanguage(language.value)}
            />
          ))}
        </View>
      </BottomSheet>
    );
  }
);

LanguagePicker.displayName = 'LanguagePicker';
