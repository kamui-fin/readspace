import { FontTilesRow } from '@components/bottom-sheets/reader-settings/font-tiles.row';
import { PreviewCard } from '@components/bottom-sheets/reader-settings/preview.card';
import { Section } from '@components/bottom-sheets/reader-settings/section.label';
import { ThemeSwatchesRow } from '@components/bottom-sheets/reader-settings/theme-swatches.row';
import { TypographyCard } from '@components/bottom-sheets/reader-settings/typography.card';
import type { SheetRef } from '@components/ui/bottom-sheet';
import { BottomSheet } from '@components/ui/bottom-sheet';
import { Text } from '@components/ui/text';
import { useReaderPreferences } from '@stores/reader-preferences';
import { forwardRef, useMemo } from 'react';
import { Pressable, View } from 'react-native';

/**
 * The reader's settings panel.
 *
 * Every control writes to `useReaderPreferences`, which the reader turns into
 * CSS variables and injects into the live WebView — so changes land on the
 * article behind the sheet instantly, scroll position intact, and the preview
 * card at the top shows the same result without needing to look behind it.
 */
export const ReaderSettingsBottomSheet = forwardRef<SheetRef>((_props, ref) => {
  const reset = useReaderPreferences((state) => state.reset);
  const snapPoints = useMemo(() => ['82%'], []);

  return (
    <BottomSheet
      ref={ref}
      headerTitle="Reader Settings"
      snapPoints={snapPoints}
      secondaryAction={
        <Pressable
          onPress={reset}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
          <Text size={15} fontFamily="geist-medium" className="text-secondary">
            Reset
          </Text>
        </Pressable>
      }>
      <View className="gap-6 pb-6 pt-1">
        <PreviewCard />

        <Section title="Theme">
          <ThemeSwatchesRow />
        </Section>

        <Section title="Select Font">
          <FontTilesRow />
        </Section>

        <Section title="Typography">
          <TypographyCard />
        </Section>
      </View>
    </BottomSheet>
  );
});

ReaderSettingsBottomSheet.displayName = 'ReaderSettingsBottomSheet';
