import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { READER_FONT_LABELS, type ReaderFontFamily } from '@lib/constants/reader';
import { useReaderPreferences } from '@stores/reader-preferences';
import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

const FONTS: { value: ReaderFontFamily; face: 'garamond' | 'geist' | 'mono' }[] = [
  { value: 'serif', face: 'garamond' },
  { value: 'sans', face: 'geist' },
  { value: 'mono', face: 'mono' },
];

/** Specimen size, and the box it is centred in. */
const SPECIMEN_SIZE = 26;
const SPECIMEN_BOX = 34;

/**
 * Typeface tiles: each one is set in the face it selects, so the choice is a
 * specimen rather than a name to decode.
 *
 * The specimen sits in a fixed-height box with an explicit line height rather
 * than flowing in the tile. Each face carries a different ascent and descent,
 * so laying them out naturally left the three "Aa"s sitting at three different
 * heights and none of them optically centred in its tile.
 */
export function FontTilesRow() {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const fontFamily = useReaderPreferences((state) => state.fontFamily);
  const setFontFamily = useReaderPreferences((state) => state.setFontFamily);

  return (
    <View className="flex-row gap-2.5">
      {FONTS.map(({ value, face }) => {
        const isActive = value === fontFamily;
        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={READER_FONT_LABELS[value]}
            onPress={() => {
              Haptics.selectionAsync();
              setFontFamily(value);
            }}
            className="flex-1 items-center justify-center gap-1 rounded-2xl py-3.5"
            style={({ pressed }) => ({
              backgroundColor: colors.grey6,
              borderWidth: 1.5,
              borderColor: isActive ? colors.secondary : 'transparent',
              opacity: pressed && !isActive ? 0.6 : 1,
            })}>
            <View style={{ height: SPECIMEN_BOX, justifyContent: 'center' }}>
              <Text
                size={SPECIMEN_SIZE}
                fontFamily={face}
                style={{
                  color: colors.black,
                  lineHeight: SPECIMEN_BOX,
                  textAlign: 'center',
                  includeFontPadding: false,
                }}>
                Aa
              </Text>
            </View>
            <Text
              size={12}
              fontFamily={isActive ? 'geist-semibold' : 'geist'}
              style={{ color: isActive ? colors.black : colors.grey }}>
              {READER_FONT_LABELS[value]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
