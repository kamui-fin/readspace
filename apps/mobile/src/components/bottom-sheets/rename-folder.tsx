import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { BottomSheetInput } from '@components/ui/input';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BUTTON_BORDER_RADIUS } from '@lib/constants/app';
import { useUpdateFolder, ApiError } from '@readspace/shared';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';

export interface RenameFolderModalRef {
  present: (folderId: string, currentName: string) => void;
  dismiss: () => void;
}

export interface RenameFolderModalProps {
  onSuccess?: () => void;
}

export const RenameFolderModal = forwardRef<RenameFolderModalRef, RenameFolderModalProps>(
  ({ onSuccess }, ref) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const updateFolder = useUpdateFolder();
    // Uncontrolled input — see rename-feed.tsx for why (BottomSheetTextInput cursor
    // jump on Android when fed a `value` prop from state on every keystroke).
    const folderNameRef = useRef('');
    const [hasText, setHasText] = useState(false);
    const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
    const [inputKey, setInputKey] = useState(0);

    const handleChangeText = useCallback((text: string) => {
      folderNameRef.current = text;
      setHasText(text.trim().length > 0);
    }, []);

    const handleUpdateFolder = useCallback(() => {
      const trimmed = folderNameRef.current.trim();
      if (trimmed && targetFolderId) {
        updateFolder.mutate(
          { folderId: targetFolderId, name: trimmed },
          {
            onSuccess: () => {
              toast.success('Folder renamed successfully');
              onSuccess?.();
            },
            onError: (error: unknown) => {
              const message =
                error instanceof ApiError && error.status === 409
                  ? error.message
                  : 'Failed to rename folder';
              toast.error(message);
            },
          }
        );
      }
    }, [updateFolder, onSuccess, targetFolderId]);

    const handleConfirm = useCallback(() => {
      if (!folderNameRef.current.trim()) return;
      Keyboard.dismiss();
      setTimeout(() => {
        handleUpdateFolder();
        bottomSheetRef.current?.dismiss();
      }, 50);
    }, [handleUpdateFolder]);

    useImperativeHandle(ref, () => ({
      present: (folderId: string, currentName: string) => {
        setTargetFolderId(folderId);
        folderNameRef.current = currentName;
        setHasText(currentName.trim().length > 0);
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
        enablePanDownToClose={true}
        snapPoints={['25%']}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore">
        {/* Heading */}
        <Text
          className="font-geist-bold text-primary-foreground mb-1 text-2xl"
          style={{ letterSpacing: -0.5 }}>
          Rename folder
        </Text>
        <Text className="font-geist-regular text-grey dark:text-grey mb-5 text-base">
          Enter a new name for your folder.
        </Text>

        {/* Input */}
        <BottomSheetInput
          key={inputKey}
          defaultValue={folderNameRef.current}
          onChangeText={handleChangeText}
          placeholder="Folder name"
          autoFocus
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={handleConfirm}
          borderRadius={14}
        />

        {/* Update Button */}
        <View className="mt-5">
          <Button
            variant="primary"
            size="large"
            fullWidth
            onPress={handleConfirm}
            disabled={!hasText || updateFolder.isPending}
            style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
            {updateFolder.isPending ? 'Updating...' : 'Rename'}
          </Button>
        </View>
      </BottomSheet>
    );
  }
);

RenameFolderModal.displayName = 'RenameFolderModal';
