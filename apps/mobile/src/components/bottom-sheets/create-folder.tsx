import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { BottomSheetInput } from '@components/ui/input';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BUTTON_BORDER_RADIUS } from '@lib/constants/app';
import { useCreateFolder } from '@readspace/shared';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';

export interface CreateFolderModalRef {
  present: () => void;
  dismiss: () => void;
}

export interface CreateFolderModalProps {
  onSuccess?: (folder: any) => void;
}

export const CreateFolderModal = forwardRef<CreateFolderModalRef, CreateFolderModalProps>(
  ({ onSuccess }, ref) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const createFolder = useCreateFolder();
    const [folderName, setFolderName] = useState('');

    const handleCreateFolder = useCallback(
      (name?: string) => {
        const trimmed = name?.trim() ?? folderName.trim();
        if (trimmed) {
          createFolder.mutate(
            { name: trimmed },
            {
              onSuccess: (folder) => {
                toast.success('Folder created successfully');
                onSuccess?.(folder);
              },
              onError: () => {
                toast.error('Failed to create folder');
              },
            }
          );
        }
      },
      [createFolder, onSuccess, folderName]
    );

    const handleConfirm = useCallback(() => {
      if (!folderName.trim()) return;
      handleCreateFolder(folderName);
      bottomSheetRef.current?.dismiss();
      setFolderName('');
    }, [folderName, handleCreateFolder]);

    useImperativeHandle(ref, () => ({
      present: () => {
        setFolderName('');
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
          Choose a name
        </Text>
        <Text className="font-geist-regular text-grey dark:text-grey mb-5 text-base">
          Create a folder to organize your feeds.
        </Text>

        {/* Input */}
        <BottomSheetInput
          value={folderName}
          onChangeText={setFolderName}
          placeholder="e.g. Technology"
          autoFocus
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={handleConfirm}
          borderRadius={14}
        />

        {/* Create Button */}
        <View className="mt-5">
          <Button
            variant="primary"
            size="large"
            fullWidth
            onPress={handleConfirm}
            disabled={!folderName.trim()}
            style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
            Create
          </Button>
        </View>
      </BottomSheet>
    );
  }
);

CreateFolderModal.displayName = 'CreateFolderModal';
