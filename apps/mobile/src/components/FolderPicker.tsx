import { Button } from '@/components/ui/Button';
import { Radio } from '@/components/ui/Radio';
import { COLORS } from '@/constants/Colors';
import {
    BottomSheetBackdrop,
    BottomSheetFooter,
    BottomSheetModal,
    BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useFolders } from '@readspace/shared';
import { useColorScheme } from 'nativewind';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';

export interface FolderPickerRef {
    present: () => void;
    dismiss: () => void;
}

export interface FolderPickerProps {
    onFolderSelect: (folderId: string) => void;
    initialFolderId?: string | null;
}

export const FolderPicker = forwardRef<FolderPickerRef, FolderPickerProps>(
    ({ onFolderSelect, initialFolderId }, ref) => {
        const bottomSheetRef = useRef<BottomSheetModal>(null);
        const { colorScheme } = useColorScheme();
        const colors = COLORS[colorScheme ?? 'light'];

        useImperativeHandle(ref, () => ({
            present: () => bottomSheetRef.current?.present(),
            dismiss: () => bottomSheetRef.current?.dismiss(),
        }));
        const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
            initialFolderId ?? null
        );
        const { data: folders } = useFolders();

        const typedFolders = (folders as { id: string; name: string }[]) || [];

        const handleSelect = useCallback((folderId: string) => {
            setSelectedFolderId(folderId);
        }, []);

        const handleConfirm = useCallback(() => {
            if (selectedFolderId) {
                onFolderSelect(selectedFolderId);
                bottomSheetRef.current?.dismiss();
            }
        }, [selectedFolderId, onFolderSelect]);

        const renderBackdrop = useCallback(
            (props: any) => (
                <BottomSheetBackdrop
                    {...props}
                    appearsOnIndex={0}
                    disappearsOnIndex={-1}
                    opacity={0.5}
                />
            ),
            []
        );

        return (
            <BottomSheetModal
                ref={bottomSheetRef}
                enableDynamicSizing
                enablePanDownToClose
                enableDismissOnClose={true}
                backdropComponent={renderBackdrop}
                // footerComponent={renderFooter}
                backgroundStyle={{ backgroundColor: colors.white }}
                handleIndicatorStyle={{ backgroundColor: colors.green_grey }}>
                <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                    <Text className="mb-6 font-geist-bold text-2xl tracking-heading text-black dark:text-black-dark px-6">
                        Select Folder
                    </Text>
                    <View className="gap-3 pb-4 px-6">
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
                    <View className="px-6 pb-6 pt-4">
                        <Button
                            variant="primary"
                            fullWidth
                            onPress={handleConfirm}
                            disabled={!selectedFolderId}>
                            <Text className="font-geist-semibold text-base text-white">
                                Confirm
                            </Text>
                        </Button>
                    </View>
                </BottomSheetScrollView>
            </BottomSheetModal>
        );
    }
);

FolderPicker.displayName = 'FolderPicker';
