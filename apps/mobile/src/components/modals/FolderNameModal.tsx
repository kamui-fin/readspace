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
    onCreateFolder?: (name: string) => void;
    onUpdateFolder?: (name: string) => void;
    mode?: 'create' | 'update';
    initialName?: string;
}

export const FolderNameModal = forwardRef<BottomSheetModal, FolderNameModalProps>(
    ({ onCreateFolder, onUpdateFolder, mode = 'create', initialName = '' }, ref) => {
        const { colorScheme } = useColorScheme();
        const colors = COLORS[colorScheme ?? 'light'];
        const [folderName, setFolderName] = useState(initialName);
        const [isOpen, setIsOpen] = useState(false);
        const snapPoints = useMemo(() => ['40%', '70%'], []);

        const handleSubmit = useCallback(() => {
            if (folderName.trim()) {
                if (mode === 'create') {
                    onCreateFolder?.(folderName.trim());
                } else {
                    onUpdateFolder?.(folderName.trim());
                }
                setFolderName(mode === 'create' ? '' : initialName);
                if (ref && typeof ref !== 'function' && ref.current) {
                    ref.current.dismiss();
                }
            }
        }, [folderName, mode, onCreateFolder, onUpdateFolder, initialName, ref]);

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
                enableDismissOnClose={true}
                stackBehavior="push"
                keyboardBehavior="extend"
                keyboardBlurBehavior="restore"
                android_keyboardInputMode="adjustResize"
                backdropComponent={renderBackdrop}
                backgroundStyle={{ backgroundColor: colors.white }}
                handleIndicatorStyle={{ backgroundColor: colors.green_grey }}
                onChange={(index) => {
                    setIsOpen(index >= 0);
                    if (index >= 0 && mode === 'update') {
                        setFolderName(initialName);
                    }
                }}
                onDismiss={() => {
                    setFolderName(mode === 'create' ? '' : initialName);
                    setIsOpen(false);
                }}>
                <BottomSheetView className="flex-1 px-6 py-4">
                    <Text className="mb-2 font-geist-bold text-2xl tracking-heading text-black dark:text-black-dark">
                        {mode === 'create' ? 'Choose a name' : 'Rename folder'}
                    </Text>
                    <Text className="mb-6 font-geist text-base text-grey dark:text-grey-dark">
                        {mode === 'create'
                            ? 'Creating a folder helps you organize your feeds.'
                            : 'Enter a new name for this folder.'}
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
                        onSubmitEditing={handleSubmit}
                    />

                    <Pressable
                        onPress={handleSubmit}
                        disabled={!folderName.trim()}
                        className={`items-center justify-center rounded-2xl py-4 transition-opacity ${
                            folderName.trim()
                                ? 'bg-primary active:opacity-70'
                                : 'bg-mid-grey opacity-50 dark:bg-mid-grey-dark'
                        }`}>
                        <Text
                            className={`font-geist-semibold text-base ${
                                folderName.trim()
                                    ? 'text-white dark:text-white-dark'
                                    : 'text-grey dark:text-grey-dark'
                            }`}>
                            {mode === 'create' ? 'Create' : 'Rename'}
                        </Text>
                    </Pressable>
                </BottomSheetView>
            </BottomSheetModal>
        );
    }
);

FolderNameModal.displayName = 'FolderNameModal';
