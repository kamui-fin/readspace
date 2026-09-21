import type { StyleProp, ViewStyle } from 'react-native';

export interface BackButtonProps {
  onPress?: () => void;
  /** Icon colour. Defaults to the app's grey. */
  color?: string;
  /** Force the native colour scheme (reader themes); defaults to the app theme. */
  isDark?: boolean;
  style?: StyleProp<ViewStyle>;
  className?: string;
}
