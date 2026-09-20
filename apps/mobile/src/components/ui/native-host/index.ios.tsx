import { Host } from '@expo/ui/swift-ui';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import type { NativeHostProps } from './index';

/**
 * The single entry point into SwiftUI. Wraps `Host` so every native surface follows the app's
 * theme (not the phone's), and sizes to its content by default.
 *
 * One `NativeHost` per surface — never per list row or divider (each Host is a native view with
 * its own layout pass).
 */
export function NativeHost({ children, style, isDark, matchContents = true }: NativeHostProps) {
  const appIsDark = useIsDarkMode();
  return (
    <Host
      matchContents={matchContents}
      colorScheme={(isDark ?? appIsDark) ? 'dark' : 'light'}
      style={style}>
      {children}
    </Host>
  );
}
