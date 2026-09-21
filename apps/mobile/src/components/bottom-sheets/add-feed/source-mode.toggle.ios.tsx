import { NativeHost } from '@components/ui/native-host';
import { Label, Picker, Text } from '@expo/ui/swift-ui';
import { accessibilityLabel, labelStyle, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import {
  ADD_FEED_MODE_LABELS,
  ADD_FEED_MODES,
  type AddFeedMode,
  type SourceModeToggleProps,
} from './source-mode.toggle.types';

export type { SourceModeToggleProps } from './source-mode.toggle.types';

/** One row of a `UISegmentedControl`, so the host doesn't collapse inside the sheet's stack. */
const TOGGLE_HEIGHT = 32;

/**
 * iOS: a real `UISegmentedControl`.
 *
 * This was a hand-rolled pill — a Reanimated thumb translated across a measured track, with its
 * own shadow, its own two font weights and its own `onLayout` round trip before it could draw
 * anything. All of that is what the system control already is, and none of it tracked the
 * platform: no press-and-slide between segments, no Dynamic Type, no Reduce Motion.
 */
export function SourceModeToggle({ mode, onModeChange }: SourceModeToggleProps) {
  return (
    <NativeHost matchContents={false} style={{ height: TOGGLE_HEIGHT, marginTop: 4 }}>
      <Picker
        label="Source"
        selection={mode}
        onSelectionChange={(next) => onModeChange(next as AddFeedMode)}
        modifiers={[pickerStyle('segmented')]}>
        {ADD_FEED_MODES.map((value) =>
          value === 'newsletter' ? (
            <Label
              key={value}
              title={ADD_FEED_MODE_LABELS[value]}
              systemImage="crown.fill"
              modifiers={[
                tag(value),
                labelStyle('titleAndIcon'),
                accessibilityLabel('Newsletter, Pro feature'),
              ]}
            />
          ) : (
            <Text key={value} modifiers={[tag(value)]}>
              {ADD_FEED_MODE_LABELS[value]}
            </Text>
          )
        )}
      </Picker>
    </NativeHost>
  );
}
