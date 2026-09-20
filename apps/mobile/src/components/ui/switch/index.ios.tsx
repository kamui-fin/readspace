import { NativeHost } from '@components/ui/native-host';
import { Toggle } from '@expo/ui/swift-ui';
import { labelsHidden, tint } from '@expo/ui/swift-ui/modifiers';
import { COLORS } from '@lib/constants/colors';
import type { SwitchProps } from './types';

export type { SwitchProps } from './types';

/** iOS switch: a real SwiftUI `Toggle` (system haptics, spring, iOS 26 glass thumb). */
export const Switch = ({ checked = false, onChange }: SwitchProps) => (
  <NativeHost>
    <Toggle
      isOn={checked}
      onIsOnChange={onChange}
      label="Toggle"
      modifiers={[labelsHidden(), tint(COLORS.light.secondary)]}
    />
  </NativeHost>
);
