import { Button } from '@components/ui/button';
import { BottomSheet } from '@components/ui/bottom-sheet';
import { Spinner } from '@components/ui/spinner';
import { Text } from '@components/ui/text';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { SparkleIcon } from '@components/icons/sparkle';
import { RefreshAiIcon } from '@components/icons/refresh-ai';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { Monicon } from '@monicon/native';
import type { SummarizeResponse } from '@readspace/shared';
import { forwardRef, useMemo } from 'react';
import { View } from 'react-native';

interface ArticleSummaryBottomSheetProps {
  summary: SummarizeResponse | null;
  isLoading: boolean;
  onRegenerate?: () => void;
  onClose?: () => void;
}

export const ArticleSummaryBottomSheet = forwardRef<
  BottomSheetModal,
  ArticleSummaryBottomSheetProps
>(({ summary, isLoading, onRegenerate, onClose }, ref) => {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const snapPoints = useMemo(() => ['75%', '90%'], []);

  // Header left with icon and title
  const headerLeft = useMemo(
    () => (
      <View className="flex-row items-center gap-1">
        <SparkleIcon size={20} color={colors.primary} />
        <Text size="xl" fontFamily="geist-semibold" className="text-primary_foreground">
          AI Summary
        </Text>
      </View>
    ),
    [colors.primary]
  );

  return (
    <BottomSheet
      ref={ref}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableDynamicSizing={false}
      headerLeft={headerLeft}
      onDismiss={onClose}>
      {isLoading ? (
        <View className="items-center justify-center py-12">
          <Spinner size="large" color={colors.primary} />
          <Text size="lg" fontFamily="geist-medium" className="text-grey dark:text-grey mt-4">
            Generating summary...
          </Text>
        </View>
      ) : summary?.success && summary.summary ? (
        <View className="gap-4">
          {/* Summary Text */}
          <View className="bg-grey6 dark:bg-grey6 rounded-2xl p-5">
            <Text
              size="lg"
              fontFamily="geist"
              className="text-primary_foreground leading-relaxed"
              style={{ lineHeight: 24 }}>
              {summary.summary}
            </Text>
          </View>

          {/* Actions */}
          <View className="mt-2 gap-3">
            {onRegenerate && (
              <Button
                variant="secondary"
                size="large"
                onPress={onRegenerate}
                leftIcon={<RefreshAiIcon size={18} color={colors.primary} />}>
                Regenerate Summary
              </Button>
            )}
          </View>

          {/* Info */}
          <View className="bg-muted dark:bg-muted mt-4 rounded-xl p-4">
            <View className="flex-row items-start gap-2">
              <View style={{ marginTop: 2 }}>
                <Monicon name="solar:info-circle-bold" size={18} color={colors.muted_foreground} />
              </View>
              <Text
                size="base"
                fontFamily="geist"
                className="text-muted_foreground dark:text-muted_foreground flex-1 leading-relaxed">
                AI-generated summaries may not capture all nuances. Always read the full article for
                complete context.
              </Text>
            </View>
          </View>
        </View>
      ) : summary?.error ? (
        <View className="items-center justify-center py-12">
          <View
            className="mb-4 items-center justify-center rounded-full"
            style={{
              backgroundColor: colors.icon_bg_red,
              width: 56,
              height: 56,
            }}>
            <Monicon name="solar:danger-triangle-bold" size={28} color={colors.destructive} />
          </View>
          <Text
            size="lg"
            fontFamily="geist-semibold"
            className="text-primary_foreground mb-2 text-center">
            Failed to Generate Summary
          </Text>
          <Text size="base" fontFamily="geist" className="text-grey dark:text-grey text-center">
            {summary.error}
          </Text>
          {onRegenerate && (
            <Button
              variant="primary"
              size="medium"
              onPress={onRegenerate}
              className="mt-6"
              leftIcon={<RefreshAiIcon size={18} color={colors.white} />}>
              Try Again
            </Button>
          )}
        </View>
      ) : (
        <View className="items-center justify-center py-12">
          <Text size="base" fontFamily="geist" className="text-grey dark:text-grey text-center">
            No summary available
          </Text>
        </View>
      )}
    </BottomSheet>
  );
});

ArticleSummaryBottomSheet.displayName = 'ArticleSummaryBottomSheet';
