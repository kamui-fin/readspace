import type { TrueSheetProps } from '@lodev09/react-native-true-sheet';
import type { ReactNode } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

/**
 * Imperative handle every sheet in the app exposes. It deliberately mirrors the small subset of
 * the old gorhom `BottomSheetModal` API our callers used (`present` / `dismiss` / `snapToIndex`)
 * so screens keep working unchanged while the implementation is a native True Sheet.
 */
export interface SheetRef {
  /** Presents the sheet at the given detent index (default 0). */
  present: (index?: number) => Promise<void>;
  /** Dismisses the sheet. */
  dismiss: () => Promise<void>;
  /** Resizes the presented sheet to the given detent index. */
  snapToIndex: (index: number) => Promise<void>;
}

export interface BaseSheetProps
  extends Omit<
    TrueSheetProps,
    'children' | 'detents' | 'header' | 'footer' | 'onDidDismiss' | 'onDetentChange'
  > {
  children: ReactNode;
  /** Detent heights, smallest first (max 3). `'auto'` sizes to content. Default `['90%']`. */
  snapPoints?: string[];
  /** Detent index to present at on mount (-1 = start closed, the default). */
  index?: number;
  /** Called when the sheet finishes dismissing (any cause: drag, back, backdrop, code). */
  onDismiss?: () => void;
  /** Called when the active detent changes. */
  onChange?: (index: number) => void;
  /** Pass `false` to lock the sheet against drag-to-dismiss and backdrop tap. */
  enablePanDownToClose?: boolean;
  /**
   * Opt into the native iOS 26 glass material instead of an opaque background. Off by default —
   * see-through sheets make list content behind them hard to read.
   */
  glass?: boolean;
}

export interface BottomSheetProps extends BaseSheetProps {
  headerTitle?: string;
  headerTitleAlign?: 'left' | 'center';
  headerTitleStyle?: StyleProp<TextStyle>;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  headerClassName?: string;
  /** Positioned at the right, same slot as `headerRight`. */
  secondaryAction?: ReactNode;
  /** Fixed footer buttons, floating above the scroll content. */
  footerActions?: ReactNode;
  footerClassName?: string;
  /** Override the footer's bottom padding (defaults to the device safe-area inset). */
  footerBottomPadding?: number;
  /** Override the horizontal padding on the scroll content (default 24). Pass 0 for full-bleed. */
  contentPaddingHorizontal?: number;
  /**
   * Whether the sheet wraps `children` in its own pinned `ScrollView` (default). Set to `false`
   * when the children are (or contain) their own scrollable list.
   */
  contentScrollable?: boolean;
}
