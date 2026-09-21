import { Alert } from 'react-native';
import type { ConfirmOptions, UseNativeConfirm } from './types';

export type { ConfirmOptions, UseNativeConfirm } from './types';

/** Android / default: the system alert dialog. iOS uses a SwiftUI `ConfirmationDialog`. */
export function useNativeConfirm(): UseNativeConfirm {
  const confirm = ({
    title,
    message,
    confirmLabel,
    cancelLabel = 'Cancel',
    destructive,
    onConfirm,
  }: ConfirmOptions) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel' },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
    ]);
  };

  return { confirm, dialog: null };
}
