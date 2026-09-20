import type { ReaderSurfaceColors } from '@lib/constants/reader';

export type ArticleViewMode = 'original' | 'extracted' | 'translated';

/**
 * Everything behind the reader's overflow control.
 *
 * Modelled as data rather than a rendered sheet because both platforms now draw it as a real
 * system menu — a `UIMenu` inside the navigation bar on iOS, an anchored dropdown on Android —
 * and neither can be handed React children to put in its rows.
 */
export interface ArticleOptionsMenuModel {
  /** The mode the reader is on; its row carries the checkmark. */
  currentView: ArticleViewMode;
  onSelectView: (view: ArticleViewMode) => void;
  /** Omitted while the article is still loading, when there is no link to open yet. */
  onOpenInBrowser?: () => void;
  /** Clipped articles are already the full text — there is nothing to extract from. */
  canExtract: boolean;
  /**
   * The full text is already in hand. Drives the row's wording: picking it when it isn't
   * kicks off a scrape, and the menu should say so before you tap rather than after.
   */
  hasExtractedContent: boolean;
  /**
   * A translation exists to switch back to. Until then the row is not offered at all: picking
   * "Translated" used to open the language picker, which made one of three supposedly equal
   * radio options secretly a different kind of control. Translating lives in the reader's Aa
   * menu; this group only switches between views that already exist.
   */
  hasTranslatedContent: boolean;
}

export interface ArticleActionBarProps {
  /** Whether the bar is shown. Owned by the screen: tapping the page toggles it. */
  visible?: boolean;
  onClose: () => void;
  onShare: () => void;
  onBookmark: () => void;
  onGenerateSummary?: () => void;
  onCopyLink?: () => void;
  isBookmarked: boolean;
  isClipped: boolean;
  /** Swap the bookmark for a "mark as read & remove from read later" checkmark */
  showDone?: boolean;
  /** Omit to drop the overflow control entirely — newsletters have nothing to put in it. */
  options?: ArticleOptionsMenuModel;
  colors: ReaderSurfaceColors;
}
