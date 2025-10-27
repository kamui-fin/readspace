import { Button } from '@/components/ui/Button';
import { Radio } from '@/components/ui/Radio';
import BottomSheet, {
    BottomSheetBackdrop,
    BottomSheetFooter,
    BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useFolders } from '@readspace/shared';
import { forwardRef, useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

export interface FolderPickerProps {
    onFolderSelect: (folderId: string) => void;
    initialFolderId?: string | null;
}

export const FolderPicker = forwardRef<BottomSheet, FolderPickerProps>(
    ({ onFolderSelect, initialFolderId }, ref) => {
        const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
            initialFolderId ?? null
        );
        const snapPoints = useMemo(() => ['50%', '75%'], []);
        const { data: folders } = useFolders();

        const typedFolders = (folders as { id: string; name: string }[]) || [];

        const handleSelect = useCallback(
            (folderId: string) => {
                setSelectedFolderId(folderId);
            },
            []
        );

        const handleConfirm = useCallback(() => {
            if (selectedFolderId) {
                onFolderSelect(selectedFolderId);
                // Close the bottom sheet
                if (ref && typeof ref !== 'function' && ref.current) {
                    ref.current.close();
                }
            }
        }, [selectedFolderId, onFolderSelect, ref]);

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

        const renderFooter = useCallback(
            (props: any) => (
                <BottomSheetFooter {...props}>
                    <View className="border-t border-light-grey bg-white px-6 pb-6 pt-4">
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
                </BottomSheetFooter>
            ),
            [handleConfirm, selectedFolderId]
        );

        return (
            <BottomSheet
                ref={ref}
                index={-1}
                snapPoints={snapPoints}
                enablePanDownToClose
                backdropComponent={renderBackdrop}
                footerComponent={renderFooter}
                backgroundStyle={{ backgroundColor: '#FFFFFF' }}
                handleIndicatorStyle={{ backgroundColor: '#D1DBCD' }}>
                <View className="flex-1 px-6">
                    <Text className="mb-6 font-geist-bold text-2xl tracking-heading text-black">
                        Select Folder
                    </Text>
                    <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                        <View className="gap-3 pb-4">
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
                    </BottomSheetScrollView>
                </View>
            </BottomSheet>
        );
    }
);

FolderPicker.displayName = 'FolderPicker';
