export interface NativeScreenHeaderProps {
  /**
   * Inline title for the navigation bar. Left out on screens that already carry their own heading
   * in the content, where the bar is just the back button.
   */
  title?: string;
  /** Label beside the back chevron. Defaults to the previous screen's title. */
  backTitle?: string;
}
