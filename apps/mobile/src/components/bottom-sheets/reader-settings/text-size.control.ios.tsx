import { NativeHost } from '@components/ui/native-host';
import { Stepper } from '@expo/ui/swift-ui';
import { accessibilityLabel, labelsHidden } from '@expo/ui/swift-ui/modifiers';
import { READER_FONT_SIZES } from '@lib/constants/reader';
import { useReaderPreferences } from '@stores/reader-preferences';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

/**
 * Native SwiftUI `Stepper` (system −/+ capsule, auto-disables at the bounds).
 *
 * UIKit's stepper does not vibrate on its own — unlike a picker or a switch, it ships with no
 * feedback generator — so each accepted step fires a selection tap here. Without it the control
 * is the one place in the sheet where pressing a button feels like nothing happened.
 */
export function TextSizeControl() {
  const fontSizeIndex = useReaderPreferences((state) => state.fontSizeIndex);
  const setFontSizeIndex = useReaderPreferences((state) => state.setFontSizeIndex);

  const handleValueChange = useCallback(
    (value: number) => {
      // The stepper keeps reporting at the bounds; only a real change should buzz.
      if (value === fontSizeIndex) return;
      Haptics.selectionAsync();
      setFontSizeIndex(value);
    },
    [fontSizeIndex, setFontSizeIndex]
  );

  return (
    <NativeHost>
      <Stepper
        label="Text size"
        value={fontSizeIndex}
        min={0}
        max={READER_FONT_SIZES.length - 1}
        step={1}
        onValueChange={handleValueChange}
        modifiers={[labelsHidden(), accessibilityLabel('Text size')]}
      />
    </NativeHost>
  );
}
