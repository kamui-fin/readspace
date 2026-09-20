import type { SearchActionsProps } from '@components/screens/discover/ui/search-actions';

export interface CategorySearchHandle {
  focus: () => void;
  blur: () => void;
}

export interface CategoryChromeProps extends SearchActionsProps {
  /** Display name of the category; also the screen title. */
  title: string;
  inputValue: string;
  onChangeText: (text: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}
