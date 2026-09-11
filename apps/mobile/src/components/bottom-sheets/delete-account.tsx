import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { BottomSheetInput } from '@components/ui/input';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useSession } from '@contexts/auth-context';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BUTTON_BORDER_RADIUS } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { ApiError, useDeleteAccount } from '@readspace/shared';
import { useQueryClient } from '@tanstack/react-query';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Keyboard } from 'react-native';

export interface DeleteAccountModalRef {
  present: () => void;
  dismiss: () => void;
}

const CONFIRM_PHRASE = 'DELETE';

export const DeleteAccountModal = forwardRef<DeleteAccountModalRef>((_props, ref) => {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const deleteAccount = useDeleteAccount();
  const { signOut } = useSession();
  const queryClient = useQueryClient();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  // Uncontrolled input — see rename-folder.tsx for why (BottomSheetTextInput cursor
  // jump on Android when fed a `value` prop from state on every keystroke).
  const confirmTextRef = useRef('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  const handleChangeText = useCallback((text: string) => {
    confirmTextRef.current = text;
    setIsConfirmed(text.trim() === CONFIRM_PHRASE);
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmTextRef.current.trim() !== CONFIRM_PHRASE) return;
    Keyboard.dismiss();

    deleteAccount.mutate(undefined, {
      onSuccess: async () => {
        bottomSheetRef.current?.dismiss();
        await signOut();
        queryClient.clear();
        toast.success('Your account has been deleted');
      },
      onError: (error: unknown) => {
        const message = error instanceof ApiError ? error.message : 'Failed to delete account';
        toast.error(message);
      },
    });
  }, [deleteAccount, signOut, queryClient]);

  useImperativeHandle(ref, () => ({
    present: () => {
      confirmTextRef.current = '';
      setIsConfirmed(false);
      setInputKey((prev) => prev + 1);
      bottomSheetRef.current?.present();
    },
    dismiss: () => {
      bottomSheetRef.current?.dismiss();
    },
  }));

  return (
    <BottomSheet
      ref={bottomSheetRef}
      enablePanDownToClose={!deleteAccount.isPending}
      snapPoints={['50%']}
      footerActions={
        <Button
          variant="ghost"
          size="large"
          fullWidth
          className="border-0"
          textClassName="text-white"
          onPress={handleConfirm}
          disabled={!isConfirmed || deleteAccount.isPending}
          loading={deleteAccount.isPending}
          style={{ borderRadius: BUTTON_BORDER_RADIUS, backgroundColor: colors.red }}>
          Delete my account
        </Button>
      }>
      <Text
        className="font-geist-bold text-primary-foreground mb-1 text-2xl"
        style={{ letterSpacing: -0.5 }}>
        Delete account
      </Text>
      <Text className="font-geist-regular text-grey dark:text-grey mb-4 text-base">
        This permanently deletes your account and everything in it — feeds, folders, saved articles,
        and highlights. This action cannot be undone.
      </Text>

      <Text className="font-geist-medium text-primary-foreground mb-2 text-sm">
        Type {CONFIRM_PHRASE} to confirm
      </Text>
      <BottomSheetInput
        key={inputKey}
        defaultValue=""
        onChangeText={handleChangeText}
        placeholder={CONFIRM_PHRASE}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        returnKeyType="done"
        onSubmitEditing={handleConfirm}
        borderRadius={14}
      />
    </BottomSheet>
  );
});

DeleteAccountModal.displayName = 'DeleteAccountModal';
