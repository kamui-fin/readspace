import type { ArticleOptionsMenuModel, ArticleViewMode } from '../article-actions.bar.types';

/** Labels live here so the two platform menus can never drift apart. */
export const VIEW_MODE_SECTION_TITLE = 'Viewing Mode';

const VIEW_MODE_LABELS: Record<ArticleViewMode, string> = {
  original: 'Original RSS',
  extracted: 'Full Text',
  translated: 'Translated',
};

export const OPEN_IN_BROWSER_LABEL = 'Open in Browser';

/**
 * Full Text is the one row that may do work rather than just switch: with nothing extracted
 * yet, picking it goes out and scrapes the page. The label says which of the two it is.
 */
export function viewModeLabel(mode: ArticleViewMode, model: ArticleOptionsMenuModel): string {
  if (mode === 'extracted' && !model.hasExtractedContent) return 'Extract Full Text';
  return VIEW_MODE_LABELS[mode];
}

/**
 * The modes offered right now, in menu order. `extracted` drops out for clipped articles (the
 * clip *is* the extraction) and `translated` only appears once one exists.
 */
export function availableViewModes(model: ArticleOptionsMenuModel): ArticleViewMode[] {
  const modes: ArticleViewMode[] = ['original'];
  if (model.canExtract) modes.push('extracted');
  if (model.hasTranslatedContent) modes.push('translated');
  return modes;
}
