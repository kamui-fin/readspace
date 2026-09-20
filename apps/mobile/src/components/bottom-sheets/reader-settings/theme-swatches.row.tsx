import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { READER_SEPIA_COLORS, READER_TONE_LABELS, type ReaderTone } from '@lib/constants/reader';
import { useReaderPreferences } from '@stores/reader-preferences';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

const TONES: ReaderTone[] = ['system', 'light', 'sepia', 'dark'];
const SWATCH_SIZE = 40;

/** The page tone as a row of round swatches, the way Apple Books shows its themes. */
export function ThemeSwatchesRow() {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const tone = useReaderPreferences((state) => state.tone);
  const setTone = useReaderPreferences((state) => state.setTone);

  return (
    <View
      className="flex-row justify-between rounded-3xl px-5 py-4"
      style={{ backgroundColor: colors.grey6 }}>
      {TONES.map((value) => {
        const isActive = value === tone;
        return (
          <Pressable
            key={value}
            accessibilityLabel={`${READER_TONE_LABELS[value]} theme`}
            onPress={() => {
              Haptics.selectionAsync();
              setTone(value);
            }}
            className="items-center gap-2"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            {/* The ring sits outside the swatch so the swatch itself always shows
                its true colour — a selection state must never tint the thing it
                is advertising. */}
            <View
              className="items-center justify-center rounded-full"
              style={{
                width: SWATCH_SIZE + 8,
                height: SWATCH_SIZE + 8,
                borderWidth: 2,
                borderColor: isActive ? colors.secondary : 'transparent',
              }}>
              <Swatch tone={value} />
            </View>
            <Text
              size={12}
              fontFamily={isActive ? 'geist-semibold' : 'geist'}
              style={{ color: isActive ? colors.black : colors.grey }}>
              {READER_TONE_LABELS[value]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Swatch({ tone }: { tone: ReaderTone }) {
  const border = { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(128,128,128,0.35)' };

  if (tone === 'system') {
    // Half light, half dark: "whatever the phone is doing".
    return (
      <View
        className="flex-row overflow-hidden rounded-full"
        style={{ width: SWATCH_SIZE, height: SWATCH_SIZE, ...border }}>
        <View style={{ flex: 1, backgroundColor: COLORS.light.background }} />
        <View style={{ flex: 1, backgroundColor: COLORS.dark.background }} />
      </View>
    );
  }

  const fill =
    tone === 'sepia'
      ? READER_SEPIA_COLORS.background
      : tone === 'dark'
        ? COLORS.dark.background
        : COLORS.light.background;

  return (
    <View
      className="rounded-full"
      style={{ width: SWATCH_SIZE, height: SWATCH_SIZE, backgroundColor: fill, ...border }}
    />
  );
}
