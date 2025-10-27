import { Radio } from '@/components/ui/Radio';
import type { Folder } from '@/utils/mockFeeds';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

export interface FolderPickerProps {
    folders: Folder[];
    onFolderSelect: (folderId: string) => void;
    initialFolderId?: string | null;
}

export const FolderPicker = forwardRef<BottomSheetModal, FolderPickerProps>(
    ({ folders, onFolderSelect, initialFolderId = null }, ref) => {
        const [selectedFolderId, setSelectedFolderId] = useState<string | null>(initialFolderId);
        const snapPoints = useMemo(() => ['50%'], []);

        const handleFolderSelect = useCallback(
            (folderId: string) => {
                setSelectedFolderId(folderId);
                onFolderSelect(folderId);
                // Close the bottom sheet
                if (ref && typeof ref !== 'function' && ref.current) {
                    ref.current.dismiss();
                }
            },
            [onFolderSelect, ref]
        );

        const renderBackdrop = useCallback(
            (props: any) => (
                <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} />
            ),
            []
        );

        return (
            <BottomSheetModal
                ref={ref}
                snapPoints={snapPoints}
                enablePanDownToClose
                enableDynamicSizing
                stackBehavior="push"
                backdropComponent={renderBackdrop}
                backgroundStyle={{ backgroundColor: '#FFFFFF' }}
                handleIndicatorStyle={{ backgroundColor: '#D1DBCD' }}>
                <BottomSheetView className="flex-1 px-6">
                    <Text className="mb-6 font-geist-bold text-2xl tracking-heading text-black">
                        Move to folder
                    </Text>
                    <View className="gap-3">
                        {folders.map((folder) => (
                            <Radio
                                key={folder.id}
                                label={folder.name}
                                selected={selectedFolderId === folder.id}
                                onPress={() => handleFolderSelect(folder.id)}
                            />
                        ))}
                    </View>
                </BottomSheetView>
            </BottomSheetModal>
        );
    }
);

FolderPicker.displayName = 'FolderPicker';

