import { NativeHost } from '@components/ui/native-host';
import { Button } from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  labelStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { SUPPORTS_GLASS } from '@lib/constants/platform';
import type { BackButtonProps } from './types';

export type { BackButtonProps } from './types';

/**
 * Native back button: a SwiftUI circular `Button` with the `chevron.left` SF Symbol — Liquid
 * Glass on iOS 26+, bordered below. Same recipe as the reader's corner menu.
 */
export function BackButton({ onPress, color, isDark, style }: BackButtonProps) {
  const appIsDark = useIsDarkMode();
  const iconColor = color ?? COLORS[(isDark ?? appIsDark) ? 'dark' : 'light'].grey;
  return (
    <NativeHost isDark={isDark} style={style}>
      <Button
        label="Back"
        systemImage="chevron.left"
        onPress={onPress}
        modifiers={[
          labelStyle('iconOnly'),
          buttonStyle(SUPPORTS_GLASS ? 'glass' : 'bordered'),
          buttonBorderShape('circle'),
          controlSize('regular'),
          tint(iconColor),
        ]}
      />
    </NativeHost>
  );
}
