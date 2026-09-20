import type { ReaderSurfaceColors } from '@lib/constants/reader';
import type { ReactNode } from 'react';

export interface ArticleActionBarProps {
  /** Whether the bar is shown. Owned by the screen: tapping the page toggles it. */
  visible?: boolean;
  onClose: () => void;
  onShare: () => void;
  onBookmark: () => void;
  onMenuPress?: () => void;
  hideMenu?: boolean;
  onGenerateSummary?: () => void;
  onCopyLink?: () => void;
  isBookmarked: boolean;
  isClipped: boolean;
  /** Swap the bookmark for a "mark as read & remove from read later" checkmark */
  showDone?: boolean;
  menuTrigger?: ReactNode;
  colors: ReaderSurfaceColors;
}
