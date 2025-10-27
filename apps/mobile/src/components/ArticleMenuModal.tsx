import { Switch } from '@/components/ui/Switch';
import type BottomSheet from '@gorhom/bottom-sheet';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { Monicon } from '@monicon/native';
import { forwardRef, useCallback, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LanguagePicker, type LanguageOption } from './LanguagePicker';

// Same languages as web's LanguageSelector
const TRANSLATION_LANGUAGES: LanguageOption[] = [
    { value: 'en', label: 'English', countryCode: 'GB' },
    { value: 'es', label: 'Spanish', countryCode: 'ES' },
    { value: 'fr', label: 'French', countryCode: 'FR' },
    { value: 'de', label: 'German', countryCode: 'DE' },
    { value: 'it', label: 'Italian', countryCode: 'IT' },
    { value: 'pt', label: 'Portuguese', countryCode: 'BR' },
    { value: 'ru', label: 'Russian', countryCode: 'RU' },
    { value: 'ja', label: 'Japanese', countryCode: 'JP' },
    { value: 'ko', label: 'Korean', countryCode: 'KR' },
    { value: 'zh', label: 'Chinese (Simplified)', countryCode: 'CN' },
    { value: 'ar', label: 'Arabic', countryCode: 'SA' },
    { value: 'hi', label: 'Hindi', countryCode: 'IN' },
    { value: 'nl', label: 'Dutch', countryCode: 'NL' },
    { value: 'sv', label: 'Swedish', countryCode: 'SE' },
    { value: 'no', label: 'Norwegian', countryCode: 'NO' },
    { value: 'da', label: 'Danish', countryCode: 'DK' },
    { value: 'fi', label: 'Finnish', countryCode: 'FI' },
    { value: 'pl', label: 'Polish', countryCode: 'PL' },
    { value: 'tr', label: 'Turkish', countryCode: 'TR' },
    { value: 'th', label: 'Thai', countryCode: 'TH' },
    { value: 'vi', label: 'Vietnamese', countryCode: 'VN' },
];

export interface ArticleMenuModalProps {
    onCopyLink?: () => void;
    onOpenInBrowser?: () => void;
    onSummarize?: () => void;
    onTranslate?: (languageCode: string) => void;
    onWebModeChange?: (enabled: boolean) => void;
    webModeEnabled?: boolean;
}

export const ArticleMenuModal = forwardRef<BottomSheetModal, ArticleMenuModalProps>(
    (
        {
            onCopyLink,
            onOpenInBrowser,
            onSummarize,
            onTranslate,
            onWebModeChange,
            webModeEnabled = false,
        },
        ref
    ) => {
        const languagePickerRef = useRef<BottomSheet>(null);

        const handleWebModeToggle = useCallback(
            (value: boolean) => {
                onWebModeChange?.(value);
            },
            [onWebModeChange]
        );

        const handleTranslatePress = useCallback(() => {
            // Close the menu modal first
            if (ref && typeof ref !== 'function' && ref.current) {
                ref.current.dismiss();
            }
            // Open language picker
            setTimeout(() => {
                languagePickerRef.current?.snapToIndex(0);
            }, 300);
        }, [ref]);

        const handleLanguageSelect = useCallback(
            (languageCode: string) => {
                onTranslate?.(languageCode);
            },
            [onTranslate]
        );

        const renderBackdrop = useCallback(
            (props: any) => (
                <BottomSheetBackdrop
                    {...props}
                    disappearsOnIndex={-1}
                    appearsOnIndex={0}
                    opacity={0.5}
                />
            ),
            []
        );

        const menuItems = [
            {
                icon: 'solar:link-bold',
                label: 'Copy Link',
                onPress: onCopyLink,
            },
            {
                icon: 'solar:square-top-down-bold',
                label: 'Open in Browser',
                onPress: onOpenInBrowser,
            },
            {
                icon: 'solar:document-text-bold',
                label: 'Generate Summary',
                onPress: onSummarize,
            },
            {
                icon: 'lucide:languages',
                label: 'Translate',
                onPress: handleTranslatePress,
            },
        ];

        return (
            <>
                <BottomSheetModal
                    ref={ref}
                    snapPoints={['40%']}
                    enablePanDownToClose
                    backdropComponent={renderBackdrop}
                    backgroundStyle={{ backgroundColor: '#FFFFFF' }}
                    handleIndicatorStyle={{ backgroundColor: '#E0E0E0', width: 40 }}>
                    <BottomSheetView className="flex-1 px-6 py-4">
                        <Text className="mb-4 font-geist-semibold text-lg text-black">
                            Article Options
                        </Text>

                        {/* Menu Items */}
                        {menuItems.map((item, index) => (
                            <Pressable
                                key={item.label}
                                onPress={() => {
                                    if (item.label === 'Translate') {
                                        item.onPress?.();
                                    } else {
                                        item.onPress?.();
                                        // @ts-ignore - ref typing
                                        ref?.current?.dismiss();
                                    }
                                }}
                                className="flex-row items-center gap-4 py-4"
                                style={{
                                    borderTopWidth: index > 0 ? 0.5 : 0,
                                    borderTopColor: '#F0F0F0',
                                }}>
                                <Monicon name={item.icon} size={24} color="#232222" />
                                <Text className="flex-1 font-geist text-base text-black">
                                    {item.label}
                                </Text>
                            </Pressable>
                        ))}

                        {/* Web Mode Toggle */}
                        <View
                            className="flex-row items-center justify-between py-4"
                            style={{ borderTopWidth: 0.5, borderTopColor: '#F0F0F0' }}>
                            <View className="flex-row items-center gap-4">
                                <Monicon name="solar:global-bold" size={24} color="#232222" />
                                <Text className="font-geist text-base text-black">Web Mode</Text>
                            </View>
                            <Switch value={webModeEnabled} onValueChange={handleWebModeToggle} />
                        </View>
                    </BottomSheetView>
                </BottomSheetModal>

                {/* Language Picker */}
                <LanguagePicker
                    ref={languagePickerRef}
                    languages={TRANSLATION_LANGUAGES}
                    title="Select Language"
                    onLanguageChange={handleLanguageSelect}
                />
            </>
        );
    }
);

ArticleMenuModal.displayName = 'ArticleMenuModal';
