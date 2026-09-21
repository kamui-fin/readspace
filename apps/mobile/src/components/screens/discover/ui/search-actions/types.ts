/**
 * The three screen-level search controls. They travel together: whichever Discover surface you are
 * on — the landing screen or a category — you can change how search behaves without backing out
 * of it first.
 */
export interface SearchActionsProps {
  /** Search mode + content-type filters. */
  onOpenOptions: () => void;
  /** Language scope, which applies to search and trending alike. */
  onOpenLanguage: () => void;
  /** Subscribe to a feed by URL. */
  onOpenAddFeed: () => void;
}
