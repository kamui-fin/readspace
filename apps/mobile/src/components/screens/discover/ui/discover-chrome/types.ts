/** Imperative handle the Discover screen uses to drive the search field, whichever kind it is. */
export interface DiscoverSearchHandle {
  focus: () => void;
  blur: () => void;
}

export interface DiscoverChromeProps {
  inputValue: string;
  /** Browse mode (no active search): shows the title row and language / add-feed actions. */
  isBrowsing: boolean;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onClear: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  onOpenLanguage: () => void;
  onOpenAddFeed: () => void;
  onOpenOptions: () => void;
}
