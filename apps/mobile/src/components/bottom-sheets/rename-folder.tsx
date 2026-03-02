import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { BottomSheetInput } from '@components/ui/input';
import { toast } from '@components/ui/toast';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BUTTON_BORDER_RADIUS } from '@lib/constants/app';
import { useUpdateFolder } from '@readspace/shared';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Text, View } from 'react-native';

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
    const [folderName, setFolderName] = useState('');
    const [targetFolderId, setTargetFolderId] = useState<string | null>(null);

    const handleUpdateFolder = useCallback(() => {
      const trimmed = folderName.trim();
      if (trimmed && targetFolderId) {
        updateFolder.mutate(
          { folderId: targetFolderId, name: trimmed },
          {
            onSuccess: () => {
              toast.success('Folder renamed successfully');
              onSuccess?.();
            },
            onError: () => {
              toast.error('Failed to rename folder');
            },
          }
        );
      }
    }, [updateFolder, onSuccess, folderName, targetFolderId]);

    const handleConfirm = useCallback(() => {
      if (!folderName.trim()) return;
      handleUpdateFolder();
      bottomSheetRef.current?.dismiss();
    }, [folderName, handleUpdateFolder]);

    useImperativeHandle(ref, () => ({
      present: (folderId: string, currentName: string) => {
        setTargetFolderId(folderId);
        setFolderName(currentName);
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
          className="font-geist-bold text-2xl text-primary-foreground dark:text-primary-foreground-dark mb-1"
          style={{ letterSpacing: -0.5 }}>
          Rename folder
        </Text>
        <Text className="font-geist-regular text-base text-grey dark:text-grey mb-5">
          Enter a new name for your folder.
        </Text>

        {/* Input */}
        <BottomSheetInput
          value={folderName}
          onChangeText={setFolderName}
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
            disabled={!folderName.trim() || updateFolder.isPending}
            style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
            {updateFolder.isPending ? 'Updating...' : 'Rename'}
          </Button>
        </View>
      </BottomSheet>
    );
  }
);

RenameFolderModal.displayName = 'RenameFolderModal';
