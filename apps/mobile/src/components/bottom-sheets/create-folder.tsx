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

interface Folder {
  id: string;
  name: string;
}

export interface CreateFolderModalProps {
  onSuccess?: (folder: Folder) => void;
}

export const CreateFolderModal = forwardRef<CreateFolderModalRef, CreateFolderModalProps>(
  ({ onSuccess }, ref) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const createFolder = useCreateFolder();
    // Uncontrolled input — see rename-feed.tsx for why (BottomSheetTextInput cursor
    // jump on Android when fed a `value` prop from state on every keystroke).
    const folderNameRef = useRef('');
    const [hasText, setHasText] = useState(false);
    const [inputKey, setInputKey] = useState(0);

    const handleChangeText = useCallback((text: string) => {
      folderNameRef.current = text;
      setHasText(text.trim().length > 0);
    }, []);

    const handleCreateFolder = useCallback(
      (name?: string) => {
        const trimmed = name?.trim() ?? folderNameRef.current.trim();
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
      [createFolder, onSuccess]
    );

    const handleConfirm = useCallback(() => {
      if (!folderNameRef.current.trim()) return;
      handleCreateFolder();
      bottomSheetRef.current?.dismiss();
    }, [handleCreateFolder]);

    useImperativeHandle(ref, () => ({
      present: () => {
        folderNameRef.current = '';
        setHasText(false);
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
          Choose a name
        </Text>
        <Text className="font-geist-regular text-grey dark:text-grey mb-5 text-base">
          Create a folder to organize your feeds.
        </Text>

        {/* Input */}
        <BottomSheetInput
          key={inputKey}
          defaultValue={folderNameRef.current}
          onChangeText={handleChangeText}
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
            disabled={!hasText}
            style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
            Create
          </Button>
        </View>
      </BottomSheet>
    );
  }
);

CreateFolderModal.displayName = 'CreateFolderModal';
