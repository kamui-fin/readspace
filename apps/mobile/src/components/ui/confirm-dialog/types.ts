import type { ReactElement } from 'react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Label of the confirming action, e.g. "Delete". */
  confirmLabel: string;
  cancelLabel?: string;
  /** Renders the confirm action in the destructive (red) role. */
  destructive?: boolean;
  onConfirm: () => void;
}

export interface UseNativeConfirm {
  /** Presents the dialog. Calls `options.onConfirm` only if the user confirms. */
  confirm: (options: ConfirmOptions) => void;
  /**
   * Render this once in the tree (anywhere inside the screen/sheet that calls `confirm`).
   * `null` on Android, where `confirm` uses the system alert instead.
   */
  dialog: ReactElement | null;
}
