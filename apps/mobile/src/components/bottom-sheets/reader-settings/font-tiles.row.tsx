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

/**
 * Typeface tiles: each one is set in the face it selects, so the choice is a
 * specimen rather than a name to decode.
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
            onPress={() => {
              Haptics.selectionAsync();
              setFontFamily(value);
            }}
            className="flex-1 items-center justify-center gap-1 rounded-2xl py-4"
            style={({ pressed }) => ({
              backgroundColor: colors.grey6,
              borderWidth: 1.5,
              borderColor: isActive ? colors.secondary : 'transparent',
              opacity: pressed && !isActive ? 0.6 : 1,
            })}>
            <Text size={26} fontFamily={face} style={{ color: colors.black }}>
              Aa
            </Text>
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
