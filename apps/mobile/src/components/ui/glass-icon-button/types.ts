import type { ButtonProps } from '@expo/ui/swift-ui';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface GlassIconButtonProps {
  /** SF Symbol name, used by the iOS SwiftUI button. */
  systemImage: NonNullable<ButtonProps['systemImage']>;
  /** Rendered instead on Android, where there are no SF Symbols. */
  children: ReactNode;
  accessibilityLabel: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Glyph tint. Defaults to the app's grey. */
  color?: string;
  /** Force the native colour scheme (reader themes); defaults to the app theme. */
  isDark?: boolean;
  style?: StyleProp<ViewStyle>;
}
