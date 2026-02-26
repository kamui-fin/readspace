import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import AddFolderBoldIcon from '@components/icons/solar/add-folder-bold';

import { Button } from '@components/ui/button';
import { Modal } from '@components/ui/modal';
import { Radio } from '@components/ui/radio';
import { useFeeds, useCreateFolder } from '@readspace/shared';
import { COLORS } from '@lib/constants/colors';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { toast } from '@components/ui/toast';

export interface FolderPickerModalRef {
  present: () => void;
  dismiss: () => void;
}

export interface FolderPickerModalProps {
  onFolderSelect: (folderId: string | null) => void;
  initialFolderId?: string | null;
}

export const FolderPickerModal = forwardRef<FolderPickerModalRef, FolderPickerModalProps>(
  ({ onFolderSelect, initialFolderId }, ref) => {
    const modalRef = useRef<BottomSheetModal>(null);
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];
    const createFolder = useCreateFolder();

    useImperativeHandle(ref, () => ({
      present: () => modalRef.current?.present(),
      dismiss: () => modalRef.current?.dismiss(),
    }));

    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
      initialFolderId ?? null
    );
    const { data: feedsData } = useFeeds();
    const folders = feedsData?.folders || [];

    const typedFolders = (folders as { id: string; name: string }[]) || [];

    const handleSelect = useCallback((folderId: string | null) => {
      setSelectedFolderId(folderId);
    }, []);

    const handleConfirm = useCallback(() => {
      onFolderSelect(selectedFolderId);
      modalRef.current?.dismiss();
    }, [selectedFolderId, onFolderSelect]);

    const handleClose = useCallback(() => {
      modalRef.current?.dismiss();
    }, []);

    const handleCreateFolder = useCallback(() => {
      Alert.prompt(
        'Create Folder',
        'Enter a name for your new folder',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Create',
            onPress: (folderName?: string) => {
              if (folderName?.trim()) {
                createFolder.mutate(
                  { name: folderName.trim() },
                  {
                    onSuccess: () => {
                      toast.success('Folder created successfully');
                    },
                    onError: () => {
                      toast.error('Failed to create folder');
                    },
                  }
                );
              }
            },
          },
        ],
        'plain-text',
        '',
        'default'
      );
    }, [createFolder]);

    return (
      <Modal
        ref={modalRef}
        headerTitle="Select Folder"
        headerTitleAlign="left"
        onClose={handleClose}
        showCloseButton={true}
        enablePanDownToClose={true}
        secondaryAction={
          <Button
            variant="icon"
            size="small"
            className="h-8 w-8"
            fullWidth={false}
            onPress={handleCreateFolder}>
            <AddFolderBoldIcon width={16} height={16} color={colors.grey} />
          </Button>
        }
        footerActions={
          <Button variant="primary" fullWidth onPress={handleConfirm}>
            Confirm
          </Button>
        }>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 0 }}>
          <View className="gap-3">
            {/* No Folder Option */}
            <Radio
              label="No folder"
              selected={selectedFolderId === null}
              onPress={() => handleSelect(null)}
            />
            {/* Folder Options */}
            {typedFolders.map((folder) => (
              <Radio
                key={folder.id}
                label={folder.name}
                selected={selectedFolderId === folder.id}
                onPress={() => handleSelect(folder.id)}
              />
            ))}
          </View>
        </ScrollView>
      </Modal>
    );
  }
);

FolderPickerModal.displayName = 'FolderPickerModal';
