import { NativeHost } from '@components/ui/native-host';
import { Picker, Text } from '@expo/ui/swift-ui';
import { accessibilityLabel, labelsHidden, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { READER_LINE_HEIGHT_LABELS, type ReaderLineHeight } from '@lib/constants/reader';
import { useReaderPreferences } from '@stores/reader-preferences';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

const LINE_HEIGHTS: ReaderLineHeight[] = ['tight', 'normal', 'relaxed'];

/**
 * Native segmented `Picker` (system segmented control; Liquid Glass on iOS 26).
 *
 * The selection tap is fired here for the same reason as the stepper's: a segmented control
 * embedded in a SwiftUI `Host` does not carry UIKit's own feedback generator across.
 */
export function LineSpacingControl() {
  const lineHeight = useReaderPreferences((state) => state.lineHeight);
  const setLineHeight = useReaderPreferences((state) => state.setLineHeight);

  const handleSelectionChange = useCallback(
    (value: ReaderLineHeight) => {
      if (value === lineHeight) return;
      Haptics.selectionAsync();
      setLineHeight(value);
    },
    [lineHeight, setLineHeight]
  );

  return (
    <NativeHost>
      <Picker
        label="Line spacing"
        selection={lineHeight}
        onSelectionChange={handleSelectionChange}
        modifiers={[pickerStyle('segmented'), labelsHidden(), accessibilityLabel('Line spacing')]}>
        {LINE_HEIGHTS.map((value) => (
          <Text key={value} modifiers={[tag(value)]}>
            {READER_LINE_HEIGHT_LABELS[value]}
          </Text>
        ))}
      </Picker>
    </NativeHost>
  );
}
