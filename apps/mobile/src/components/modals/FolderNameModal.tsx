import { COLORS } from '@/constants/Colors';
import {
    BottomSheetBackdrop,
    BottomSheetModal,
    BottomSheetTextInput,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useColorScheme } from 'nativewind';
import { forwardRef, useCallback, useMemo, useState } from 'react';
import { Pressable, Text } from 'react-native';

export interface FolderNameModalProps {
    onCreateFolder: (name: string) => void;
}

export const FolderNameModal = forwardRef<BottomSheetModal, FolderNameModalProps>(
    ({ onCreateFolder }, ref) => {
        const { colorScheme } = useColorScheme();
        const colors = COLORS[colorScheme ?? 'light'];
        const [folderName, setFolderName] = useState('');
        const [isOpen, setIsOpen] = useState(false);
        const snapPoints = useMemo(() => ['40%', '70%'], []);

        const handleCreate = useCallback(() => {
            if (folderName.trim()) {
                onCreateFolder(folderName.trim());
                setFolderName('');
                if (ref && typeof ref !== 'function' && ref.current) {
                    ref.current.dismiss();
                }
            }
        }, [folderName, onCreateFolder, ref]);

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
                ref={ref}
                snapPoints={snapPoints}
                enablePanDownToClose
                stackBehavior="push"
                keyboardBehavior="extend"
                keyboardBlurBehavior="restore"
                android_keyboardInputMode="adjustResize"
                backdropComponent={renderBackdrop}
                backgroundStyle={{ backgroundColor: colors.white }}
                handleIndicatorStyle={{ backgroundColor: colors.green_grey }}
                onChange={(index) => setIsOpen(index >= 0)}
                onDismiss={() => {
                    setFolderName('');
                    setIsOpen(false);
                }}>
                <BottomSheetView className="flex-1 px-6 py-4">
                    <Text className="mb-2 font-geist-bold text-2xl tracking-heading text-black dark:text-black-dark">
                        Choose a name
                    </Text>
                    <Text className="mb-6 font-geist text-base text-grey dark:text-grey-dark">
                        Creating a folder helps you organize your feeds.
                    </Text>

                    <BottomSheetTextInput
                        value={folderName}
                        onChangeText={setFolderName}
                        placeholder="e.g. Technology"
                        placeholderTextColor={colors.grey}
                        style={{
                            marginBottom: 24,
                            borderRadius: 16,
                            backgroundColor: colors['mid-grey'],
                            paddingHorizontal: 20,
                            paddingVertical: 16,
                            fontSize: 16,
                            fontFamily: 'Geist_400Regular',
                            color: colors.black,
                        }}
                        autoFocus={isOpen}
                        returnKeyType="done"
                        onSubmitEditing={handleCreate}
                    />

                    <Pressable
                        onPress={handleCreate}
                        disabled={!folderName.trim()}
                        className={`items-center justify-center rounded-2xl py-4 transition-opacity ${
                            folderName.trim()
                                ? 'bg-primary active:opacity-70'
                                : 'bg-mid-grey dark:bg-mid-grey-dark opacity-50'
                        }`}>
                        <Text
                            className={`font-geist-semibold text-base ${
                                folderName.trim() ? 'text-white dark:text-white-dark' : 'text-grey dark:text-grey-dark'
                            }`}>
                            Create
                        </Text>
                    </Pressable>
                </BottomSheetView>
            </BottomSheetModal>
        );
    }
);

FolderNameModal.displayName = 'FolderNameModal';
