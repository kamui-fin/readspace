import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import type { ReaderSurfaceColors } from '@lib/constants/reader';

export interface ReaderTheme {
  isDark: boolean;
  colors: ReaderSurfaceColors;
}

/**
 * The reader's surface colours.
 *
 * The reader used to carry its own tone setting (light / sepia / dark) that could diverge from
 * the app theme. That is gone: the page follows the app, which is what lets the chrome be a real
 * native navigation bar — UIKit paints those from the process appearance and has no way to be
 * told "this one screen is warm paper".
 *
 * Kept as a hook rather than inlined so the WebView and the chrome can't drift apart.
 */
export function useReaderTheme(): ReaderTheme {
  const isDark = useIsDarkMode();
  return { isDark, colors: COLORS[isDark ? 'dark' : 'light'] };
}
