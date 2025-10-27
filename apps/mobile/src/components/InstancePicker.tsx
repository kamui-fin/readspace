import { Radio } from '@/components/ui/Radio';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

export type Instance = 'custom' | 'official';

export interface InstancePickerProps {
  onInstanceChange?: (instance: Instance) => void;
  initialInstance?: Instance;
}

const INSTANCES: { value: Instance; label: string }[] = [
  { value: 'custom', label: 'Custom' },
  { value: 'official', label: 'Official' },
];

export const InstancePicker = forwardRef<BottomSheet, InstancePickerProps>(
  ({ onInstanceChange, initialInstance = 'custom' }, ref) => {
    const [selectedInstance, setSelectedInstance] = useState<Instance>(initialInstance);
    const snapPoints = useMemo(() => ['30%'], []);

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
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} />
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
        <BottomSheetView className="flex-1 px-6">
          <Text className="mb-6 font-geist-bold text-2xl tracking-heading text-black">
            Pick an instance
          </Text>
          <View className="gap-3">
            {INSTANCES.map((instance) => (
              <Radio
                key={instance.value}
                label={instance.label}
                selected={selectedInstance === instance.value}
                onPress={() => handleInstanceSelect(instance.value)}
              />
            ))}
          </View>
        </BottomSheetView>
      </BottomSheet>
    );
  }
);

InstancePicker.displayName = 'InstancePicker';
