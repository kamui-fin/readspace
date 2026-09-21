import { LineSpacingControl } from '@components/bottom-sheets/reader-settings/line-spacing.control';
import { TextSizeControl } from '@components/bottom-sheets/reader-settings/text-size.control';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { READER_FONT_SIZES } from '@lib/constants/reader';
import { ParagraphSpacingIcon, TextFormatIcon } from '@solar-icons/react-native/linear';
import { useReaderPreferences } from '@stores/reader-preferences';
import { StyleSheet, View } from 'react-native';

/** Row glyphs read at a glance; the words they replaced only restated the control beside them. */
const ROW_ICON_SIZE = 22;

/**
 * Text size and line spacing as one grouped card of rows — a glyph on the left,
 * the control on the right — matching the grouped-list rhythm of the settings
 * screen and of Apple Books' typography panel. The controls themselves are
 * native SwiftUI on iOS (`Stepper`, segmented `Picker`) and custom pills elsewhere.
 *
 * The rows are labelled by icon rather than by "Text Size" / "Line Spacing":
 * a −/+ stepper next to the word "Text Size" says the same thing twice, and the
 * words pushed the controls into a narrower column than they wanted. The names
 * survive as accessibility labels on the controls themselves.
 */
export function TypographyCard() {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const fontSizeIndex = useReaderPreferences((state) => state.fontSizeIndex);

  return (
    <View className="overflow-hidden rounded-3xl" style={{ backgroundColor: colors.grey6 }}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <TextFormatIcon size={ROW_ICON_SIZE} strokeWidth={1.8} color={colors.grey2} />
        <View className="flex-row items-center gap-3">
          <Text
            size={15}
            fontFamily="geist-medium"
            style={{ color: colors.grey, minWidth: 24, textAlign: 'right' }}>
            {READER_FONT_SIZES[fontSizeIndex]}
          </Text>
          <TextSizeControl />
        </View>
      </View>

      <View
        className="mx-5"
        style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.grey4 }}
      />

      <View className="flex-row items-center justify-between px-5 py-3">
        <ParagraphSpacingIcon size={ROW_ICON_SIZE} strokeWidth={1.8} color={colors.grey2} />
        <LineSpacingControl />
      </View>
    </View>
  );
}
