import { Radio } from '@/components/ui/Radio';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

export type Theme = 'system' | 'light' | 'dark';

export interface ThemePickerProps {
    onThemeChange?: (theme: Theme) => void;
    initialTheme?: Theme;
}

const THEMES: { value: Theme; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
];

export const ThemePicker = forwardRef<BottomSheet, ThemePickerProps>(
    ({ onThemeChange, initialTheme = 'system' }, ref) => {
        const [selectedTheme, setSelectedTheme] = useState<Theme>(initialTheme);
        const snapPoints = useMemo(() => ['35%'], []);

        const handleThemeSelect = useCallback(
            (theme: Theme) => {
                setSelectedTheme(theme);
                onThemeChange?.(theme);
                // Close the bottom sheet
                if (ref && typeof ref !== 'function' && ref.current) {
                    ref.current.close();
                }
            },
            [onThemeChange, ref]
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
                handleIndicatorStyle={{ backgroundColor: '#D1DBCD' }}
                style={{ backgroundColor: 'transparent' }}>
                <BottomSheetView className="flex-1 bg-white dark:bg-light-grey-dark px-6">
                    <Text className="mb-6 font-geist-bold text-2xl tracking-heading text-black dark:text-black-dark">
                        Pick a theme
                    </Text>
                    <View className="gap-3">
                        {THEMES.map((theme) => (
                            <Radio
                                key={theme.value}
                                label={theme.label}
                                selected={selectedTheme === theme.value}
                                onPress={() => handleThemeSelect(theme.value)}
                            />
                        ))}
                    </View>
                </BottomSheetView>
            </BottomSheet>
        );
    }
);

ThemePicker.displayName = 'ThemePicker';
