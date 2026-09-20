import type { ReaderSurfaceColors } from '@lib/constants/reader';

export interface ArticleActionGroupProps {
  colors: ReaderSurfaceColors;
  /** The reader surface is dark: drives the native colour scheme. */
  isDark: boolean;
  onShare: () => void;
  onBookmark: () => void;
  onGenerateSummary?: () => void;
  onCopyLink?: () => void;
  isBookmarked: boolean;
  isClipped: boolean;
  /** Swap the bookmark for a "mark as read" checkmark. */
  showDone?: boolean;
}
