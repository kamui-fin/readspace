import { NativeHost } from '@components/ui/native-host';
import { Button, ConfirmationDialog, Spacer, Text } from '@expo/ui/swift-ui';
import { useCallback, useState } from 'react';
import type { ConfirmOptions, UseNativeConfirm } from './types';

export type { ConfirmOptions, UseNativeConfirm } from './types';

/**
 * iOS: a SwiftUI `ConfirmationDialog` (action sheet on iPhone, popover on iPad) with proper
 * destructive/cancel roles. It needs an anchor view, so the dialog lives in a 1pt invisible host.
 *
 * Options stay in state after dismissal so the dialog can finish its exit animation.
 */
export function useNativeConfirm(): UseNativeConfirm {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [isPresented, setIsPresented] = useState(false);

  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next);
    setIsPresented(true);
  }, []);

  const dialog = options ? (
    <NativeHost style={{ position: 'absolute', width: 1, height: 1 }}>
      <ConfirmationDialog
        title={options.title}
        titleVisibility="visible"
        isPresented={isPresented}
        onIsPresentedChange={setIsPresented}>
        <ConfirmationDialog.Trigger>
          <Spacer />
        </ConfirmationDialog.Trigger>
        <ConfirmationDialog.Actions>
          <Button
            label={options.confirmLabel}
            role={options.destructive ? 'destructive' : 'default'}
            onPress={() => {
              setIsPresented(false);
              options.onConfirm();
            }}
          />
          <Button label={options.cancelLabel ?? 'Cancel'} role="cancel" />
        </ConfirmationDialog.Actions>
        {options.message ? (
          <ConfirmationDialog.Message>
            <Text>{options.message}</Text>
          </ConfirmationDialog.Message>
        ) : null}
      </ConfirmationDialog>
    </NativeHost>
  ) : null;

  return { confirm, dialog };
}
