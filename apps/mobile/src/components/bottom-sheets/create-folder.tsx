import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { toast } from '@components/ui/toast';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BUTTON_BORDER_RADIUS } from '@lib/constants/app';
import { useCreateFolder } from '@readspace/shared';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Text, View } from 'react-native';

export interface CreateFolderModalRef {
  present: () => void;
  dismiss: () => void;
}

export interface CreateFolderModalProps {
  onSuccess?: () => void;
}

export const CreateFolderModal = forwardRef<CreateFolderModalRef, CreateFolderModalProps>(
  ({ onSuccess }, ref) => {
    const modalRef = useRef<BottomSheetModal>(null);
    const createFolder = useCreateFolder();
    const [folderName, setFolderName] = useState('');

    useImperativeHandle(ref, () => ({
      present: () => {
        setFolderName('');
        modalRef.current?.present();
      },
      dismiss: () => modalRef.current?.dismiss(),
    }));

    const handleConfirm = useCallback(() => {
      if (folderName.trim()) {
        createFolder.mutate(
          { name: folderName.trim() },
          {
            onSuccess: () => {
              toast.success('Folder created successfully');
              setFolderName('');
              modalRef.current?.dismiss();
              onSuccess?.();
            },
            onError: () => {
              toast.error('Failed to create folder');
            },
          }
        );
      }
    }, [folderName, createFolder, onSuccess]);

    return (
      <BottomSheet
        ref={modalRef}
        headerTitle="Create Folder"
        headerTitleAlign="left"
        enablePanDownToClose={true}
        snapPoints={['50%']}
        bottomInset={0}
        containerClassName="rounded-3xl overflow-hidden"
        headerClassName="px-4">
        <View>
          <Text className="mb-4 font-geist text-base text-grey dark:text-grey-dark">
            Enter a name for your new folder
          </Text>
          <Input
            value={folderName}
            onChangeText={setFolderName}
            placeholder="Folder name"
            autoFocus
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
            borderRadius={12}
          />
          <View className="mt-6">
            <Button
              variant="primary"
              size="large"
              fullWidth
              onPress={handleConfirm}
              disabled={!folderName.trim()}
              style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
              Confirm
            </Button>
          </View>
        </View>
      </BottomSheet>
    );
  }
);

CreateFolderModal.displayName = 'CreateFolderModal';
