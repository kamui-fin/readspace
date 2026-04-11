import CopyBoldIcon from '@components/icons/solar/copy-bold';
import DocumentTextBoldIcon from '@components/icons/solar/document-text-bold';
import EarthBoldIcon from '@components/icons/solar/earth-bold';
import GlobalBoldIcon from '@components/icons/solar/global-bold';
import SparkleIcon from '@components/icons/local/sparkle';
import { BottomSheet } from '@components/ui/bottom-sheet';
import { Text } from '@components/ui/text';
import { BottomSheetScrollView, type BottomSheetModal } from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { forwardRef, useMemo } from 'react';
import { Pressable, View } from 'react-native';

export type ArticleViewMode = 'original' | 'extracted' | 'translated';

interface ArticleOptionsBottomSheetProps {
    currentView: ArticleViewMode;
    onSelectView: (view: ArticleViewMode) => void;
    onTranslate: () => void;
    onGenerateSummary: () => void;
    onCopyLink: () => void;
    onOpenInBrowser: () => void;
    onClose?: () => void;
    hasExtractedContent: boolean;
    hasTranslatedContent: boolean;
    canExtractContent: boolean;
    isClipped: boolean;
}

export const ArticleOptionsBottomSheet = forwardRef<
    BottomSheetModal,
    ArticleOptionsBottomSheetProps
>(
    (
        {
            currentView,
            onSelectView,
            onTranslate,
            onGenerateSummary,
            onCopyLink,
            onOpenInBrowser,
            onClose,
            hasExtractedContent,
            hasTranslatedContent,
            canExtractContent,
            isClipped,
        },
        ref
    ) => {
        const isDark = useIsDarkMode();
        const colors = COLORS[isDark ? 'dark' : 'light'];
        const greyColor = isDark ? COLORS.dark.grey : COLORS.light.grey;
        const activeColor = colors.primary;

        const snapPoints = useMemo(() => ['50%', '75%'], []);

        // Helper for rendering an option row
        const renderOption = (
            icon: React.ReactNode,
            title: string,
            subtitle?: string,
            onPress?: () => void,
            isActive?: boolean,
            isDisabled?: boolean
        ) => (
            <Pressable
                onPress={() => {
                    if (!isDisabled && onPress) {
                        onPress();
                        if (ref && typeof ref !== 'function' && ref.current) {
                            ref.current.dismiss();
                        }
                    }
                }}
                disabled={isDisabled}
                className={`flex-row items-center justify-between rounded-xl px-4 py-3 ${isActive ? 'bg-primary/10' : ''
                    } ${isDisabled ? 'opacity-50' : 'active:bg-grey6 dark:active:bg-grey6-dark'}`}>
                <View className="flex-row items-center gap-3">
                    <View
                        className="items-center justify-center rounded-lg"
                        style={{ width: 40, height: 40, backgroundColor: colors.grey6, opacity: isActive ? 1 : 0.8 }}>
                        {icon}
                    </View>
                    <View>
                        <Text
                            size="base"
                            fontFamily="geist-semibold"
                            className={isActive ? 'text-primary ' : 'text-primary_foreground '}>
                            {title}
                        </Text>
                        {subtitle && (
                            <Text size="sm" fontFamily="geist" className="mt-0.5 text-grey">
                                {subtitle}
                            </Text>
                        )}
                    </View>
                </View>
            </Pressable>
        );

        return (
            <BottomSheet
                ref={ref}
                snapPoints={snapPoints}
                enablePanDownToClose
                onDismiss={onClose}>
                <BottomSheetScrollView
                    className="flex-1 bg-white"
                    showsVerticalScrollIndicator={false}>

                    {/* View Mode Section */}
                    <Text size="sm" fontFamily="geist-bold" className="mb-2 ml-4 mt-2 tracking-wide text-grey uppercase">
                        Viewing Mode
                    </Text>
                    <View className="mb-4">
                        {renderOption(
                            <DocumentTextBoldIcon width={22} height={22} color={currentView === 'original' ? activeColor : greyColor} />,
                            'Original RSS',
                            'Fastest, provided by feed',
                            () => onSelectView('original'),
                            currentView === 'original'
                        )}

                        {!isClipped && renderOption(
                            <GlobalBoldIcon width={22} height={22} color={currentView === 'extracted' ? activeColor : greyColor} />,
                            canExtractContent && !hasExtractedContent ? 'Extract Full Text' : 'Full Text',
                            'Extracted from original site',
                            () => onSelectView('extracted'),
                            currentView === 'extracted'
                        )}

                        {renderOption(
                            <EarthBoldIcon width={22} height={22} color={currentView === 'translated' ? activeColor : greyColor} />,
                            'Translated',
                            hasTranslatedContent
                                ? (currentView === 'translated' ? 'Tap to change language' : 'View current translation')
                                : 'Pick a language to translate',
                            hasTranslatedContent && currentView !== 'translated' ? () => onSelectView('translated') : onTranslate,
                            currentView === 'translated'
                        )}
                    </View>

                    <View className="mx-4 mb-4 h-px bg-divider" />

                    {/* Actions Section */}
                    <Text size="sm" fontFamily="geist-bold" className="mb-2 ml-4 tracking-wide text-grey uppercase">
                        Actions
                    </Text>
                    <View className="mb-8">
                        {!isClipped && renderOption(
                            <SparkleIcon width={22} height={22} fill={greyColor} />,
                            'Generate AI Summary',
                            undefined,
                            onGenerateSummary
                        )}

                        {!isClipped && renderOption(
                            <EarthBoldIcon width={22} height={22} color={greyColor} />,
                            hasTranslatedContent ? 'Translate to a different language' : 'Translate Article',
                            hasTranslatedContent ? 'Change current language' : 'Pick a language',
                            onTranslate
                        )}

                        {renderOption(
                            <CopyBoldIcon width={22} height={22} color={greyColor} />,
                            'Copy Link',
                            undefined,
                            onCopyLink
                        )}

                        {renderOption(
                            <GlobalBoldIcon width={22} height={22} color={greyColor} />,
                            'Open in Browser',
                            undefined,
                            onOpenInBrowser
                        )}
                    </View>
                </BottomSheetScrollView>
            </BottomSheet>
        );
    }
);

ArticleOptionsBottomSheet.displayName = 'ArticleOptionsBottomSheet';
