import type { ReaderSurfaceColors } from '@lib/constants/reader';

export interface ReaderSkimState {
  /** Highlights are currently visible on the page. */
  active: boolean;
  /** A generation request is in flight — the row shows as busy and can't be re-triggered. */
  generating: boolean;
  onPress: () => void;
}

export interface ReaderCornerMenuProps {
  colors: ReaderSurfaceColors;
  /** The reader surface is dark — drives the native menu's colour scheme. */
  isDark: boolean;
  onOpenSettings: () => void;
  onScrollToTop: () => void;
  /** Omitted when the article has too few headings for an outline to be useful. */
  onOpenOutline?: () => void;
  /** Omitted for articles AI Skim can't run on (newsletters). */
  skim?: ReaderSkimState;
}

/** Diameter of the corner button — shared so both platforms line up with the bottom bar. */
export const READER_CORNER_BUTTON_SIZE = 44;
