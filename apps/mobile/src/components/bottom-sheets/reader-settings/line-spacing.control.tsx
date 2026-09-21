import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { READER_LINE_HEIGHT_LABELS, type ReaderLineHeight } from '@lib/constants/reader';
import { useReaderPreferences } from '@stores/reader-preferences';
import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

const LINE_HEIGHTS: ReaderLineHeight[] = ['tight', 'normal', 'relaxed'];

/** Android / default: our own segmented pill. iOS renders a native segmented `Picker`. */
export function LineSpacingControl() {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const lineHeight = useReaderPreferences((state) => state.lineHeight);
  const setLineHeight = useReaderPreferences((state) => state.setLineHeight);

  return (
    <View className="flex-row rounded-full p-0.5" style={{ backgroundColor: colors.grey5 }}>
      {LINE_HEIGHTS.map((value) => {
        const isActive = value === lineHeight;
        return (
          <Pressable
            key={value}
            onPress={() => {
              Haptics.selectionAsync();
              setLineHeight(value);
            }}
            className="rounded-full px-3 py-1.5"
            style={{ backgroundColor: isActive ? colors.background : 'transparent' }}>
            <Text
              size={13}
              fontFamily={isActive ? 'geist-semibold' : 'geist-medium'}
              style={{ color: isActive ? colors.black : colors.grey }}>
              {READER_LINE_HEIGHT_LABELS[value]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
