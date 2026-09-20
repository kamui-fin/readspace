import { NativeHost } from '@components/ui/native-host';
import { Stepper } from '@expo/ui/swift-ui';
import { labelsHidden } from '@expo/ui/swift-ui/modifiers';
import { READER_FONT_SIZES } from '@lib/constants/reader';
import { useReaderPreferences } from '@stores/reader-preferences';

/** Native SwiftUI `Stepper` (system −/+ capsule, haptics, auto-disables at the bounds). */
export function TextSizeControl() {
  const fontSizeIndex = useReaderPreferences((state) => state.fontSizeIndex);
  const setFontSizeIndex = useReaderPreferences((state) => state.setFontSizeIndex);

  return (
    <NativeHost>
      <Stepper
        label="Text size"
        value={fontSizeIndex}
        min={0}
        max={READER_FONT_SIZES.length - 1}
        step={1}
        onValueChange={setFontSizeIndex}
        modifiers={[labelsHidden()]}
      />
    </NativeHost>
  );
}
