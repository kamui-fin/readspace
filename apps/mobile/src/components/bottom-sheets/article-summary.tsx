import SparkleIcon from '@components/icons/local/sparkle';
import DangerTriangleBoldIcon from '@components/icons/solar/danger-triangle-bold';
import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { Skeleton } from '@components/ui/skeleton';
import { Text } from '@components/ui/text';
import { type BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import type { SummarizeResponse } from '@readspace/shared';
import { forwardRef, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

interface ArticleSummaryBottomSheetProps {
  summary: SummarizeResponse | null;
  isLoading: boolean;
  error?: string | null;
  onRegenerate?: () => void;
  onClose?: () => void;
}

export const ArticleSummaryBottomSheet = forwardRef<
  BottomSheetModal,
  ArticleSummaryBottomSheetProps
>(({ summary, isLoading, error, onRegenerate, onClose }, ref) => {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const snapPoints = useMemo(() => ['75%', '90%'], []);

  // Header left with icon and title
  const headerLeft = useMemo(
    () => (
      <View className="flex-row items-center gap-1">
        <SparkleIcon
          width={20}
          height={20}
          color={isDark ? colors.secondary : colors.primary}
          fill={isDark ? colors.secondary : colors.primary}
        />
        <Text size="xl" fontFamily="geist-semibold" className="text-primary_foreground">
          The Gist
        </Text>
      </View>
    ),
    [colors.primary, colors.secondary, isDark]
  );

  const markdownStyles = useMemo(
    () =>
      StyleSheet.create({
        body: {
          fontFamily: 'Geist_400Regular',
          fontSize: 16,
          lineHeight: 26,
          color: colors.primary_foreground,
        },
        heading1: {
          fontFamily: 'Geist_700Bold',
          fontSize: 22,
          marginTop: 16,
          marginBottom: 8,
          color: colors.primary_foreground,
        },
        heading2: {
          fontFamily: 'Geist_600SemiBold',
          fontSize: 18,
          marginTop: 16,
          marginBottom: 6,
          color: colors.primary_foreground,
        },
        heading3: {
          fontFamily: 'Geist_600SemiBold',
          fontSize: 16,
          marginTop: 12,
          marginBottom: 6,
          color: colors.primary_foreground,
        },
        strong: {
          fontFamily: 'Geist_700Bold',
          fontWeight: 'normal',
        },
        em: {
          fontFamily: 'Geist_400Regular_Italic',
          fontStyle: 'normal',
        },
        list_item: { marginTop: 4, marginBottom: 4 },
        bullet_list: { marginTop: 4, marginBottom: 12 },
        ordered_list: { marginTop: 4, marginBottom: 12 },
        paragraph: { marginTop: 4, marginBottom: 12 },
        link: { color: colors.primary, textDecorationLine: 'none' },
      }),
    [colors]
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
        <View className="w-full py-4">
          <Skeleton variant="text" height={20} width="100%" className="mb-2" />
          <Skeleton variant="text" height={20} width="100%" className="mb-2" />
          <Skeleton variant="text" height={20} width="90%" className="mb-2" />
          <Skeleton variant="text" height={20} width="85%" className="mb-6" />

          <Skeleton variant="text" height={20} width="100%" className="mb-2" />
          <Skeleton variant="text" height={20} width="100%" className="mb-2" />
          <Skeleton variant="text" height={20} width="75%" className="mb-2" />
        </View>
      ) : summary?.summary ? (
        <BottomSheetScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48 }}>
          <Markdown style={markdownStyles}>{summary.summary}</Markdown>
        </BottomSheetScrollView>
      ) : error ? (
        <View className="items-center justify-center py-12">
          <View
            className="mb-4 items-center justify-center rounded-full"
            style={{
              backgroundColor: colors.icon_bg_red,
              width: 56,
              height: 56,
            }}>
            <DangerTriangleBoldIcon width={28} height={28} color={colors.destructive} />
          </View>
          <Text
            size="lg"
            fontFamily="geist-semibold"
            className="text-primary_foreground mb-2 text-center">
            Failed to Generate Summary
          </Text>
          <Text size="base" fontFamily="geist" className="text-grey dark:text-grey text-center">
            {error}
          </Text>
          {onRegenerate && (
            <Button variant="primary" size="medium" onPress={onRegenerate} className="mt-6">
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
