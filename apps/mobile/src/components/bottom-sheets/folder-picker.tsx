import {
  CreateFolderModal,
  type CreateFolderModalRef,
} from '@components/bottom-sheets/create-folder';
import SolarFolderLinearIcon from '@components/icons/solar/folder-linear';
import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { EmptyState } from '@components/ui/empty-state';
import { Radio } from '@components/ui/radio';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BUTTON_BORDER_RADIUS } from '@lib/constants/app';
import { useFeeds } from '@readspace/shared';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';

export interface FolderPickerBottomSheetRef {
  present: () => void;
  dismiss: () => void;
}

export interface FolderPickerBottomSheetProps {
  onFolderSelect: (folderId: string | null) => void;
  initialFolderId?: string | null;
}

export const FolderPickerBottomSheet = forwardRef<
  FolderPickerBottomSheetRef,
  FolderPickerBottomSheetProps
>(({ onFolderSelect, initialFolderId }, ref) => {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const createFolderModalRef = useRef<CreateFolderModalRef>(null);

  useImperativeHandle(ref, () => ({
    present: () => bottomSheetRef.current?.present(),
    dismiss: () => bottomSheetRef.current?.dismiss(),
  }));

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(initialFolderId ?? null);
  const { data: feedsData } = useFeeds();
  const folders = feedsData?.folders || [];
  const typedFolders = (folders as { id: string; name: string }[]) || [];

  const handleSelect = useCallback((folderId: string | null) => {
    setSelectedFolderId(folderId);
  }, []);

  const handleConfirm = useCallback(() => {
    onFolderSelect(selectedFolderId);
    bottomSheetRef.current?.dismiss();
  }, [selectedFolderId, onFolderSelect]);

  const handleNewFolder = useCallback(() => {
    createFolderModalRef.current?.present();
  }, []);

  return (
    <>
      <BottomSheet
        ref={bottomSheetRef}
        headerTitle="Select Folder"
        headerTitleAlign="left"
        enablePanDownToClose={true}>
        {typedFolders.length > 0 ? (
          <View className="gap-3">
            {typedFolders.map((folder) => (
              <Radio
                key={folder.id}
                label={folder.name}
                selected={selectedFolderId === folder.id}
                onPress={() => handleSelect(folder.id)}
              />
            ))}
          </View>
        ) : (
          <EmptyState icon={SolarFolderLinearIcon} message="No folders" className="py-8" />
        )}

        {/* Bottom action buttons */}
        <View className="mt-6 flex-row gap-3">
          <Button
            variant={typedFolders.length > 0 ? 'secondary' : 'primary'}
            size="large"
            fullWidth={false}
            className="flex-1"
            onPress={handleNewFolder}
            style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
            New Folder
          </Button>
          {typedFolders.length > 0 && (
            <Button
              variant="primary"
              size="large"
              fullWidth={false}
              className="flex-1"
              onPress={handleConfirm}
              style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
              Confirm
            </Button>
          )}
        </View>
      </BottomSheet>

      {/* Create Folder Modal */}
      <CreateFolderModal
        ref={createFolderModalRef}
        onSuccess={(folder) => {
          onFolderSelect(folder.id);
          bottomSheetRef.current?.dismiss();
        }}
      />
    </>
  );
});

FolderPickerBottomSheet.displayName = 'FolderPickerBottomSheet';
