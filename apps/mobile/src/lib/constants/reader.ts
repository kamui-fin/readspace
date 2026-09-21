import { COLORS } from '@lib/constants/colors';

/**
 * Typography scales for the article reader.
 *
 * Everything here is delivered to the WebView as a CSS custom property and
 * re-injected when it changes, so adjusting a setting restyles the already
 * rendered page instead of reloading it — the reader keeps its scroll position
 * and the reader never flashes a skeleton mid-article.
 */

/** Body font size in px. The stepper walks this array; index 2 is the default. */
export const READER_FONT_SIZES = [16, 17, 19, 21, 24] as const;
export const READER_DEFAULT_FONT_SIZE_INDEX = 2;

export type ReaderFontFamily = 'serif' | 'sans' | 'mono';

/**
 * All three stacks are already pulled in by the reader's Google Fonts @import,
 * so switching costs no extra network request.
 */
export const READER_FONT_STACKS: Record<ReaderFontFamily, string> = {
  serif: "'EB Garamond', Georgia, Cambria, 'Times New Roman', Times, serif",
  sans: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'Geist Mono', Consolas, 'Liberation Mono', Menlo, Courier, monospace",
};

export const READER_FONT_LABELS: Record<ReaderFontFamily, string> = {
  serif: 'Serif',
  sans: 'Sans-serif',
  mono: 'Monospace',
};

/**
 * Serif and mono need a touch more size than sans at the same nominal step:
 * Garamond runs small on the x-height, Geist Mono runs wide. Applied as a
 * multiplier so the stepper stays a single shared scale.
 */
export const READER_FONT_SIZE_SCALE: Record<ReaderFontFamily, number> = {
  serif: 1,
  sans: 0.94,
  mono: 0.9,
};

export type ReaderLineHeight = 'tight' | 'normal' | 'relaxed';

export const READER_LINE_HEIGHTS: Record<ReaderLineHeight, number> = {
  tight: 1.45,
  normal: 1.65,
  relaxed: 1.9,
};

export const READER_LINE_HEIGHT_LABELS: Record<ReaderLineHeight, string> = {
  tight: 'Tight',
  normal: 'Normal',
  relaxed: 'Relaxed',
};

/**
 * A `COLORS.light`-shaped palette with the token values widened to `string`.
 * `COLORS` is declared `as const`, so its members carry literal types that a
 * plain themed palette can't be assigned to directly.
 */
export type ReaderSurfaceColors = { [K in keyof typeof COLORS.light]: string };
