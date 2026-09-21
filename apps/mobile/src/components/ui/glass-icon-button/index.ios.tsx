import { NativeHost } from '@components/ui/native-host';
import { Button } from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  frame,
  labelStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BACK_BUTTON_SIZE } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { SUPPORTS_GLASS } from '@lib/constants/platform';
import type { GlassIconButtonProps } from './types';

export type { GlassIconButtonProps } from './types';

/**
 * A circular SwiftUI icon button — Liquid Glass on iOS 26, bordered below. The same recipe the
 * back button uses, so every floating action in the app is one shape and one size.
 *
 * `controlSize` alone sizes the capsule to its glyph, which comes out smaller than the icon
 * buttons beside it; the frame pins it to the shared size instead.
 */
export function GlassIconButton({
  systemImage,
  accessibilityLabel,
  onPress,
  disabled,
  color,
  isDark,
  style,
}: GlassIconButtonProps) {
  const appIsDark = useIsDarkMode();
  const iconColor = color ?? COLORS[(isDark ?? appIsDark) ? 'dark' : 'light'].grey;
  return (
    // Explicit size for the same reason as the back button: a self-sizing Host collapses when
    // its parent gives it no dimensions.
    <NativeHost
      isDark={isDark}
      matchContents={false}
      style={[{ width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE }, style]}>
      <Button
        label={accessibilityLabel}
        systemImage={systemImage}
        onPress={onPress}
        modifiers={[
          labelStyle('iconOnly'),
          buttonStyle(SUPPORTS_GLASS ? 'glass' : 'bordered'),
          buttonBorderShape('circle'),
          controlSize('large'),
          frame({ width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE }),
          disabledModifier(Boolean(disabled)),
          tint(iconColor),
        ]}
      />
    </NativeHost>
  );
}
