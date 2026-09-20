import { LineSpacingControl } from '@components/bottom-sheets/reader-settings/line-spacing.control';
import { TextSizeControl } from '@components/bottom-sheets/reader-settings/text-size.control';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { READER_FONT_SIZES } from '@lib/constants/reader';
import { useReaderPreferences } from '@stores/reader-preferences';
import { StyleSheet, View } from 'react-native';

/**
 * Text size and line spacing as one grouped card of rows — title on the left,
 * the control on the right — matching the grouped-list rhythm of the settings
 * screen and of Apple Books' typography panel. The controls themselves are
 * native SwiftUI on iOS (`Stepper`, segmented `Picker`) and custom pills elsewhere.
 */
export function TypographyCard() {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const fontSizeIndex = useReaderPreferences((state) => state.fontSizeIndex);

  return (
    <View className="overflow-hidden rounded-3xl" style={{ backgroundColor: colors.grey6 }}>
      <View className="flex-row items-center justify-between px-5 py-3.5">
        <Text size={15} fontFamily="geist-medium" style={{ color: colors.black }}>
          Text Size
        </Text>
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

      <View className="flex-row items-center justify-between px-5 py-3.5">
        <Text size={15} fontFamily="geist-medium" style={{ color: colors.black }}>
          Line Spacing
        </Text>
        <LineSpacingControl />
      </View>
    </View>
  );
}
