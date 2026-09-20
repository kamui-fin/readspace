import { NativeHost } from '@components/ui/native-host';
import { Picker, Text } from '@expo/ui/swift-ui';
import { labelsHidden, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { READER_LINE_HEIGHT_LABELS, type ReaderLineHeight } from '@lib/constants/reader';
import { useReaderPreferences } from '@stores/reader-preferences';

const LINE_HEIGHTS: ReaderLineHeight[] = ['tight', 'normal', 'relaxed'];

/** Native segmented `Picker` (system segmented control; Liquid Glass on iOS 26). */
export function LineSpacingControl() {
  const lineHeight = useReaderPreferences((state) => state.lineHeight);
  const setLineHeight = useReaderPreferences((state) => state.setLineHeight);

  return (
    <NativeHost>
      <Picker
        label="Line spacing"
        selection={lineHeight}
        onSelectionChange={(value: ReaderLineHeight) => setLineHeight(value)}
        modifiers={[pickerStyle('segmented'), labelsHidden()]}>
        {LINE_HEIGHTS.map((value) => (
          <Text key={value} modifiers={[tag(value)]}>
            {READER_LINE_HEIGHT_LABELS[value]}
          </Text>
        ))}
      </Picker>
    </NativeHost>
  );
}
