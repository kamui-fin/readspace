import { Radio } from '@/components/ui/Radio';
import { Switch } from '@/components/ui/Switch';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { Monicon } from '@monicon/native';
import { forwardRef, useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

export type SortBy = 'lastRead' | 'title' | 'progress';
export type SortOrder = 'ascending' | 'descending';

export interface SortPickerProps {
    onSortChange?: (sortBy: SortBy, order: SortOrder) => void;
    initialSortBy?: SortBy;
    initialOrder?: SortOrder;
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
    { value: 'lastRead', label: 'Last read' },
    { value: 'title', label: 'Title' },
    { value: 'progress', label: 'Progress' },
];

export const SortPicker = forwardRef<BottomSheet, SortPickerProps>(
    ({ onSortChange, initialSortBy = 'lastRead', initialOrder = 'descending' }, ref) => {
        const [selectedSort, setSelectedSort] = useState<SortBy>(initialSortBy);
        const [sortOrder, setSortOrder] = useState<SortOrder>(initialOrder);
        const snapPoints = useMemo(() => ['45%'], []);

        const handleSortSelect = useCallback(
            (sortBy: SortBy) => {
                setSelectedSort(sortBy);
                onSortChange?.(sortBy, sortOrder);
            },
            [onSortChange, sortOrder]
        );

        const handleOrderChange = useCallback(
            (isDescending: boolean) => {
                const order = isDescending ? 'descending' : 'ascending';
                setSortOrder(order);
                onSortChange?.(selectedSort, order);
            },
            [onSortChange, selectedSort]
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
                        Sort by
                    </Text>

                    <View className="mb-6 gap-3">
                        {SORT_OPTIONS.map((option) => (
                            <Radio
                                key={option.value}
                                label={option.label}
                                selected={selectedSort === option.value}
                                onPress={() => handleSortSelect(option.value)}
                            />
                        ))}
                    </View>

                    <View className="flex-row items-center justify-between rounded-2xl bg-mid-grey px-5 py-4">
                        <View className="flex-row items-center gap-3">
                            <Monicon
                                name={
                                    sortOrder === 'descending'
                                        ? 'solar:sort-from-top-to-bottom-bold'
                                        : 'solar:sort-from-bottom-to-top-bold'
                                }
                                size={24}
                                color="#90988B"
                            />
                            <Text className="font-geist-medium text-base text-grey">
                                {sortOrder === 'descending' ? 'Descending' : 'Ascending'}
                            </Text>
                        </View>
                        <Switch
                            value={sortOrder === 'descending'}
                            onValueChange={handleOrderChange}
                        />
                    </View>
                </BottomSheetView>
            </BottomSheet>
        );
    }
);

SortPicker.displayName = 'SortPicker';

