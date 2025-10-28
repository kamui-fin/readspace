import { Radio } from '@/components/ui/Radio';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

export type Instance = 'cloud' | 'custom';

export interface InstancePickerProps {
    onInstanceChange?: (instance: Instance) => void;
    initialInstance?: Instance;
}

const INSTANCES: { value: Instance; label: string; description: string }[] = [
    {
        value: 'cloud',
        label: 'Cloud',
        description: 'Use the official Readspace cloud instance',
    },
    {
        value: 'custom',
        label: 'Self-hosted',
        description: 'Configure your own self-hosted instance',
    },
];

export const InstancePicker = forwardRef<BottomSheet, InstancePickerProps>(
    ({ onInstanceChange, initialInstance = 'cloud' }, ref) => {
        const [selectedInstance, setSelectedInstance] = useState<Instance>(initialInstance);
        const snapPoints = useMemo(() => ['40%'], []);

        const handleInstanceSelect = useCallback(
            (instance: Instance) => {
                setSelectedInstance(instance);
                onInstanceChange?.(instance);
                // Close the bottom sheet
                if (ref && typeof ref !== 'function' && ref.current) {
                    ref.current.close();
                }
            },
            [onInstanceChange, ref]
        );

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
            <BottomSheet
                ref={ref}
                index={-1}
                snapPoints={snapPoints}
                enablePanDownToClose
                backdropComponent={renderBackdrop}
                backgroundStyle={{ backgroundColor: '#FFFFFF' }}
                handleIndicatorStyle={{ backgroundColor: '#D1DBCD' }}>
                <BottomSheetView className="flex-1 px-6 pb-6">
                    <Text className="mb-2 font-geist-bold text-2xl tracking-heading text-black">
                        Pick an instance
                    </Text>
                    <Text className="mb-6 font-geist text-base text-grey">
                        Choose between cloud or self-hosted instance
                    </Text>
                    <View className="gap-4">
                        {INSTANCES.map((instance) => (
                            <View key={instance.value}>
                                <Radio
                                    label={instance.label}
                                    selected={selectedInstance === instance.value}
                                    onPress={() => handleInstanceSelect(instance.value)}
                                />
                                <Text className="ml-10 mt-1 font-geist text-sm text-grey">
                                    {instance.description}
                                </Text>
                            </View>
                        ))}
                    </View>
                </BottomSheetView>
            </BottomSheet>
        );
    }
);

InstancePicker.displayName = 'InstancePicker';
