import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import {
  READER_SEPIA_COLORS,
  type ReaderSurfaceColors,
  type ResolvedReaderTone,
} from '@lib/constants/reader';
import { useReaderPreferences } from '@stores/reader-preferences';

export interface ReaderTheme {
  tone: ResolvedReaderTone;
  /** True for the dark tone only — sepia is a light surface. */
  isDark: boolean;
  colors: ReaderSurfaceColors;
}

/**
 * The reader's own surface theme. It starts from the app theme and lets the
 * reader settings override it, so someone can read on warm paper without
 * flipping the whole app to light mode.
 *
 * Reader chrome must use this rather than `useIsDarkMode()` + `COLORS`, or the
 * RN-side header and dock will disagree with the WebView's page colour.
 */
export function useReaderTheme(): ReaderTheme {
  const appIsDark = useIsDarkMode();
  const preference = useReaderPreferences((state) => state.tone);

  const tone: ResolvedReaderTone =
    preference === 'system' ? (appIsDark ? 'dark' : 'light') : preference;

  if (tone === 'sepia') {
    return { tone, isDark: false, colors: READER_SEPIA_COLORS };
  }

  return { tone, isDark: tone === 'dark', colors: COLORS[tone] };
}
