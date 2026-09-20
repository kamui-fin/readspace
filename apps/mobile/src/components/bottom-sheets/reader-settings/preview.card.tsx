import { Text } from '@components/ui/text';
import { useReaderTheme } from '@hooks/useReaderTheme';
import {
  READER_FONT_SIZE_SCALE,
  READER_FONT_SIZES,
  READER_LINE_HEIGHTS,
  type ReaderFontFamily,
} from '@lib/constants/reader';
import { useReaderPreferences } from '@stores/reader-preferences';
import { StyleSheet, View } from 'react-native';

const PREVIEW_TEXT = 'Good reading is quiet. The words should be all you notice.';

const PREVIEW_FONT: Record<ReaderFontFamily, 'garamond' | 'geist' | 'mono'> = {
  serif: 'garamond',
  sans: 'geist',
  mono: 'mono',
};

/**
 * A live sample of the page. It renders in the reader's own surface colours —
 * not the sheet's — so it's the one place in the panel that shows what a
 * change will actually look like, with no need to peek behind the sheet.
 */
export function PreviewCard() {
  const { colors } = useReaderTheme();
  const fontSizeIndex = useReaderPreferences((state) => state.fontSizeIndex);
  const fontFamily = useReaderPreferences((state) => state.fontFamily);
  const lineHeight = useReaderPreferences((state) => state.lineHeight);

  const fontSize = Math.round(
    READER_FONT_SIZES[fontSizeIndex] * READER_FONT_SIZE_SCALE[fontFamily]
  );

  return (
    <View
      className="rounded-3xl px-5 py-5"
      style={{
        backgroundColor: colors.background,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.grey4,
      }}>
      <Text
        size={fontSize}
        fontFamily={PREVIEW_FONT[fontFamily]}
        style={{
          color: colors.primary_foreground,
          lineHeight: fontSize * READER_LINE_HEIGHTS[lineHeight],
        }}>
        {PREVIEW_TEXT}
      </Text>
    </View>
  );
}
