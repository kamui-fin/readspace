import { COLORS } from '@/constants/Colors';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useColorScheme } from 'nativewind';
import { forwardRef, useCallback, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

export interface ConfirmationModalProps {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
}

export const ConfirmationModal = forwardRef<BottomSheetModal, ConfirmationModalProps>(
    (
        { title, message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel },
        ref
    ) => {
        const { colorScheme } = useColorScheme();
        const colors = COLORS[colorScheme ?? 'light'];
        const snapPoints = useMemo(() => ['35%'], []);

        const handleConfirm = useCallback(() => {
            onConfirm();
            if (ref && typeof ref !== 'function' && ref.current) {
                ref.current.dismiss();
            }
        }, [onConfirm, ref]);

        const handleCancel = useCallback(() => {
            onCancel?.();
            if (ref && typeof ref !== 'function' && ref.current) {
                ref.current.dismiss();
            }
        }, [onCancel, ref]);

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
                enableDynamicSizing
                stackBehavior="push"
                backdropComponent={renderBackdrop}
                backgroundStyle={{ backgroundColor: colors.white }}
                handleIndicatorStyle={{ backgroundColor: colors.green_grey }}>
                <BottomSheetView className="flex-1 px-6 py-4">
                    <Text className="mb-3 font-geist-bold text-2xl tracking-heading text-black dark:text-black-dark">
                        {title}
                    </Text>
                    <Text className="mb-6 font-geist text-base text-grey dark:text-grey-dark">{message}</Text>

                    <View className="flex-row gap-3">
                        <Pressable
                            onPress={handleCancel}
                            className="flex-1 items-center justify-center rounded-2xl bg-mid-grey dark:bg-mid-grey-dark py-4 transition-opacity active:opacity-70">
                            <Text className="font-geist-semibold text-base text-grey dark:text-grey-dark">
                                {cancelText}
                            </Text>
                        </Pressable>

                        <Pressable
                            onPress={handleConfirm}
                            className="flex-1 items-center justify-center rounded-2xl bg-primary py-4 transition-opacity active:opacity-70">
                            <Text className="font-geist-semibold text-base text-white dark:text-white-dark">
                                {confirmText}
                            </Text>
                        </Pressable>
                    </View>
                </BottomSheetView>
            </BottomSheetModal>
        );
    }
);

ConfirmationModal.displayName = 'ConfirmationModal';
