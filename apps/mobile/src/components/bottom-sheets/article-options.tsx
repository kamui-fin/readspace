import SparkleIcon from '@components/icons/local/sparkle';
import CopyBoldIcon from '@components/icons/solar/copy-bold';
import DocumentTextBoldIcon from '@components/icons/solar/document-text-bold';
import EarthBoldIcon from '@components/icons/solar/earth-bold';
import GlobalBoldIcon from '@components/icons/solar/global-bold';
import { BottomSheet } from '@components/ui/bottom-sheet';
import { Text } from '@components/ui/text';
import { type BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import clsx from 'clsx';
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
  isSubscribed?: boolean;
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
      isSubscribed = true,
    },
    ref
  ) => {
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];
    const greyColor = isDark ? COLORS.dark.grey : COLORS.light.grey;
    const activeColor = colors.secondary;

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
        className={`flex-row items-center justify-between rounded-xl py-3 ${
          isDisabled ? 'opacity-50' : 'active:bg-grey6 dark:active:bg-grey6-dark'
        }`}>
        <View className="flex-row items-center gap-3">
          <View
            className="items-center justify-center rounded-lg"
            style={{
              width: 40,
              height: 40,
              backgroundColor: colors.grey6,
              opacity: isActive ? 1 : 0.8,
            }}>
            {icon}
          </View>
          <View>
            <Text
              size="base"
              fontFamily="geist-medium"
              className={clsx(isActive ? 'text-secondary ' : 'text-primary-foreground ')}>
              {title}
            </Text>
            {subtitle && (
              <Text size="sm" fontFamily="geist" className="text-grey mt-0.5">
                {subtitle}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    );

    return (
      <BottomSheet ref={ref} snapPoints={snapPoints} enablePanDownToClose onDismiss={onClose}>
        <BottomSheetScrollView
          className="bg-background flex-1"
          showsVerticalScrollIndicator={false}>
          {/* Actions Section */}
          <Text
            size="sm"
            fontFamily="geist-semibold"
            className=" text-grey uppercase tracking-wide">
            Actions
          </Text>
          <View className="mb-4">
            {!isClipped && isSubscribed &&
              renderOption(
                <SparkleIcon width={22} height={22} color={greyColor} fill={greyColor} />,
                'Generate AI Summary',
                undefined,
                onGenerateSummary
              )}

            {!isClipped && isSubscribed &&
              renderOption(
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

          {/* View Mode Section */}
          <Text
            size="sm"
            fontFamily="geist-semibold"
            className="text-grey mb-2 mt-2 uppercase tracking-wide">
            Viewing Mode
          </Text>
          <View className="mb-4">
            {renderOption(
              <DocumentTextBoldIcon
                width={22}
                height={22}
                color={currentView === 'original' ? activeColor : greyColor}
              />,
              'Original RSS',
              'Fastest, provided by feed',
              () => onSelectView('original'),
              currentView === 'original'
            )}

            {!isClipped &&
              renderOption(
                <GlobalBoldIcon
                  width={22}
                  height={22}
                  color={currentView === 'extracted' ? activeColor : greyColor}
                />,
                canExtractContent && !hasExtractedContent ? 'Extract Full Text' : 'Full Text',
                'Extracted from original site',
                () => onSelectView('extracted'),
                currentView === 'extracted',
                !canExtractContent && !hasExtractedContent
              )}

            {isSubscribed && renderOption(
              <EarthBoldIcon
                width={22}
                height={22}
                color={currentView === 'translated' ? activeColor : greyColor}
              />,
              'Translated',
              hasTranslatedContent
                ? currentView === 'translated'
                  ? 'Tap to change language'
                  : 'View current translation'
                : 'Pick a language to translate',
              hasTranslatedContent && currentView !== 'translated'
                ? () => onSelectView('translated')
                : onTranslate,
              currentView === 'translated'
            )}
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    );
  }
);

ArticleOptionsBottomSheet.displayName = 'ArticleOptionsBottomSheet';
