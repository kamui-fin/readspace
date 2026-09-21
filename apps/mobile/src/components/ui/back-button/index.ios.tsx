import { NativeHost } from '@components/ui/native-host';
import { Button } from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  frame,
  labelStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BACK_BUTTON_SIZE } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { SUPPORTS_GLASS } from '@lib/constants/platform';
import type { BackButtonProps } from './types';

export type { BackButtonProps } from './types';

/**
 * iOS back button: a SwiftUI circular `Button` with the `chevron.left` SF Symbol — Liquid Glass
 * on iOS 26, bordered below. Android uses our own chevron in `index.tsx`.
 *
 * `controlSize` alone leaves the glass capsule smaller than the icon buttons it sits beside, so
 * the frame is pinned to the same size those use.
 */
export function BackButton({ onPress, color, isDark, style }: BackButtonProps) {
  const appIsDark = useIsDarkMode();
  const iconColor = color ?? COLORS[(isDark ?? appIsDark) ? 'dark' : 'light'].grey;
  return (
    // The host carries an explicit size rather than sizing to its SwiftUI content: callers place
    // this inside absolutely-positioned wrappers with no dimensions of their own (the OPML and
    // similar-feeds headers), where a self-sizing Host collapses to zero and renders nothing.
    <NativeHost
      isDark={isDark}
      matchContents={false}
      style={[{ width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE }, style]}>
      <Button
        label="Back"
        systemImage="chevron.left"
        onPress={onPress}
        modifiers={[
          labelStyle('iconOnly'),
          buttonStyle(SUPPORTS_GLASS ? 'glass' : 'bordered'),
          buttonBorderShape('circle'),
          controlSize('large'),
          frame({ width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE }),
          tint(iconColor),
        ]}
      />
    </NativeHost>
  );
}
