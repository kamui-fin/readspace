import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import {
  READER_FONT_SIZES,
  READER_LINE_HEIGHT_LABELS,
  type ReaderLineHeight,
} from '@lib/constants/reader';
import { AddIcon, MinusIcon } from '@solar-icons/react-native/linear';
import { useReaderPreferences } from '@stores/reader-preferences';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

const LINE_HEIGHTS: ReaderLineHeight[] = ['tight', 'normal', 'relaxed'];

/**
 * Text size and line spacing as one grouped card of rows — title on the left,
 * the control on the right — matching the grouped-list rhythm of the settings
 * screen and of Apple Books' typography panel.
 */
export function TypographyCard() {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const fontSizeIndex = useReaderPreferences((state) => state.fontSizeIndex);
  const lineHeight = useReaderPreferences((state) => state.lineHeight);
  const increaseFontSize = useReaderPreferences((state) => state.increaseFontSize);
  const decreaseFontSize = useReaderPreferences((state) => state.decreaseFontSize);
  const setLineHeight = useReaderPreferences((state) => state.setLineHeight);

  const atMin = fontSizeIndex === 0;
  const atMax = fontSizeIndex === READER_FONT_SIZES.length - 1;

  const step = (action: () => void) => () => {
    Haptics.selectionAsync();
    action();
  };

  return (
    <View className="overflow-hidden rounded-3xl" style={{ backgroundColor: colors.grey6 }}>
      {/* Text size */}
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
          <View
            className="flex-row items-center overflow-hidden rounded-full"
            style={{ backgroundColor: colors.grey5 }}>
            <StepButton
              label="Decrease text size"
              disabled={atMin}
              onPress={step(decreaseFontSize)}
              color={colors.black}>
              <MinusIcon size={18} strokeWidth={2.4} color={atMin ? colors.grey3 : colors.black} />
            </StepButton>
            <View
              style={{ width: StyleSheet.hairlineWidth, height: 18, backgroundColor: colors.grey3 }}
            />
            <StepButton
              label="Increase text size"
              disabled={atMax}
              onPress={step(increaseFontSize)}
              color={colors.black}>
              <AddIcon size={18} strokeWidth={2.4} color={atMax ? colors.grey3 : colors.black} />
            </StepButton>
          </View>
        </View>
      </View>

      <View
        className="mx-5"
        style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.grey4 }}
      />

      {/* Line spacing */}
      <View className="flex-row items-center justify-between px-5 py-3.5">
        <Text size={15} fontFamily="geist-medium" style={{ color: colors.black }}>
          Line Spacing
        </Text>
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
      </View>
    </View>
  );
}

interface StepButtonProps {
  label: string;
  disabled: boolean;
  onPress: () => void;
  color: string;
  children: React.ReactNode;
}

function StepButton({ label, disabled, onPress, children }: StepButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      className="items-center justify-center"
      style={({ pressed }) => ({ width: 44, height: 34, opacity: pressed ? 0.5 : 1 })}>
      {children}
    </Pressable>
  );
}
