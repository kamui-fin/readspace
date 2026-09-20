import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { READER_FONT_SIZES } from '@lib/constants/reader';
import { AddIcon, MinusIcon } from '@solar-icons/react-native/linear';
import { useReaderPreferences } from '@stores/reader-preferences';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

/** Android / default: our own −/+ pill. iOS renders a native SwiftUI `Stepper`. */
export function TextSizeControl() {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const fontSizeIndex = useReaderPreferences((state) => state.fontSizeIndex);
  const increaseFontSize = useReaderPreferences((state) => state.increaseFontSize);
  const decreaseFontSize = useReaderPreferences((state) => state.decreaseFontSize);

  const atMin = fontSizeIndex === 0;
  const atMax = fontSizeIndex === READER_FONT_SIZES.length - 1;

  const step = (action: () => void) => () => {
    Haptics.selectionAsync();
    action();
  };

  return (
    <View
      className="flex-row items-center overflow-hidden rounded-full"
      style={{ backgroundColor: colors.grey5 }}>
      <StepButton label="Decrease text size" disabled={atMin} onPress={step(decreaseFontSize)}>
        <MinusIcon size={18} strokeWidth={2.4} color={atMin ? colors.grey3 : colors.black} />
      </StepButton>
      <View
        style={{ width: StyleSheet.hairlineWidth, height: 18, backgroundColor: colors.grey3 }}
      />
      <StepButton label="Increase text size" disabled={atMax} onPress={step(increaseFontSize)}>
        <AddIcon size={18} strokeWidth={2.4} color={atMax ? colors.grey3 : colors.black} />
      </StepButton>
    </View>
  );
}

interface StepButtonProps {
  label: string;
  disabled: boolean;
  onPress: () => void;
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
