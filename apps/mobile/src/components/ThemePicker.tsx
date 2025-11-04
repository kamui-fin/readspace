import { Radio } from '@/components/ui/Radio';
import { COLORS } from '@/constants/Colors';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { useColorScheme } from 'nativewind';
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
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
        const { colorScheme } = useColorScheme();
        const colors = COLORS[colorScheme ?? 'light'];
        const [selectedTheme, setSelectedTheme] = useState<Theme>(initialTheme);
        const snapPoints = useMemo(() => ['35%'], []);

        // Sync internal state with the store whenever initialTheme changes
        useEffect(() => {
            setSelectedTheme(initialTheme);
        }, [initialTheme]);

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
                backgroundStyle={{ backgroundColor: colors.white }}
                handleIndicatorStyle={{ backgroundColor: colors.green_grey }}
                style={{ backgroundColor: 'transparent' }}>
                <BottomSheetView className="flex-1 bg-white px-6 dark:bg-white-dark">
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
