import type { ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

export interface NativeHostProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Force the SwiftUI colour scheme (e.g. reader sepia/dark) instead of following the app theme. */
  isDark?: boolean;
  /** Size the host to its SwiftUI content (default true). Pass false to fill the parent. */
  matchContents?: boolean;
}

/**
 * Android / default fallback: SwiftUI does not exist here, so this is a plain `View`.
 * Only `.ios.tsx` implementations should render SwiftUI content through it.
 */
export function NativeHost({ children, style }: NativeHostProps) {
  return <View style={style}>{children}</View>;
}
