import {
  CreateFolderModal,
  type CreateFolderModalRef,
} from '@components/bottom-sheets/create-folder';
import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { Radio } from '@components/ui/radio';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BUTTON_BORDER_RADIUS } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { Monicon } from '@monicon/native';
import { useFolders } from '@readspace/shared';
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
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  useImperativeHandle(ref, () => ({
    present: () => bottomSheetRef.current?.present(),
    dismiss: () => bottomSheetRef.current?.dismiss(),
  }));

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(initialFolderId ?? null);
  const { data: folders } = useFolders();

  const typedFolders = (folders as { id: string; name: string }[]) || [];

  const handleSelect = useCallback((folderId: string | null) => {
    setSelectedFolderId(folderId);
  }, []);

  const handleConfirm = useCallback(() => {
    onFolderSelect(selectedFolderId);
    bottomSheetRef.current?.dismiss();
  }, [selectedFolderId, onFolderSelect]);

  const handleCreateFolderPress = useCallback(() => {
    createFolderModalRef.current?.present();
  }, []);

  return (
    <>
      <BottomSheet
        ref={bottomSheetRef}
        headerTitle="Select Folder"
        headerTitleAlign="left"
        enablePanDownToClose={true}
        headerRight={
          <View className="flex-row items-center gap-2">
            <Button
              variant="icon"
              size="small"
              className="h-8 w-8"
              fullWidth={false}
              onPress={handleCreateFolderPress}>
              <Monicon name="solar:add-folder-bold" size={16} color={colors.grey} />
            </Button>
            <Button
              variant="primary"
              size="small"
              className="h-8"
              fullWidth={false}
              onPress={handleConfirm}
              disabled={false}
              style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
              Confirm
            </Button>
          </View>
        }>
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
      </BottomSheet>

      {/* Create Folder Modal */}
      <CreateFolderModal ref={createFolderModalRef} />
    </>
  );
});

FolderPickerBottomSheet.displayName = 'FolderPickerBottomSheet';
