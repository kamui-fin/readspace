import { Radio } from '@/components/ui/Radio';
import { COLORS } from '@/constants/Colors';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { useColorScheme } from 'nativewind';
import { forwardRef, useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

export type BookFilter = 'none' | 'completed' | 'inProgress' | 'notStarted';

export interface FilterPickerProps {
    onFilterChange?: (filter: BookFilter) => void;
    initialFilter?: BookFilter;
}

const FILTER_OPTIONS: { value: BookFilter; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'completed', label: 'Completed' },
    { value: 'inProgress', label: 'In progress' },
    { value: 'notStarted', label: 'Not started' },
];

export const FilterPicker = forwardRef<BottomSheet, FilterPickerProps>(
    ({ onFilterChange, initialFilter = 'none' }, ref) => {
        const { colorScheme } = useColorScheme();
        const colors = COLORS[colorScheme ?? 'light'];
        const [selectedFilter, setSelectedFilter] = useState<BookFilter>(initialFilter);
        const snapPoints = useMemo(() => ['40%'], []);

        const handleFilterSelect = useCallback(
            (filter: BookFilter) => {
                setSelectedFilter(filter);
                onFilterChange?.(filter);
                // Close the bottom sheet
                if (ref && typeof ref !== 'function' && ref.current) {
                    ref.current.close();
                }
            },
            [onFilterChange, ref]
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
                backgroundStyle={{ backgroundColor: colors.white }}
                handleIndicatorStyle={{ backgroundColor: colors.green_grey }}>
                <BottomSheetView className="flex-1 bg-white px-6 dark:bg-white-dark">
                    <Text className="mb-6 font-geist-bold text-2xl tracking-heading text-black dark:text-black-dark">
                        Filter
                    </Text>
                    <View className="gap-3">
                        {FILTER_OPTIONS.map((option) => (
                            <Radio
                                key={option.value}
                                label={option.label}
                                selected={selectedFilter === option.value}
                                onPress={() => handleFilterSelect(option.value)}
                            />
                        ))}
                    </View>
                </BottomSheetView>
            </BottomSheet>
        );
    }
);

FilterPicker.displayName = 'FilterPicker';
