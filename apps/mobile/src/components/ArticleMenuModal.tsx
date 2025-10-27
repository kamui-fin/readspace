import { Switch } from '@/components/ui/Switch';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { Monicon } from '@monicon/native';
import { forwardRef, useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

export interface ArticleMenuModalProps {
    onCopyLink?: () => void;
    onOpenInBrowser?: () => void;
    onSummarize?: () => void;
    onTranslate?: () => void;
    onWebModeChange?: (enabled: boolean) => void;
    initialWebMode?: boolean;
}

export const ArticleMenuModal = forwardRef<BottomSheetModal, ArticleMenuModalProps>(
    (
        {
            onCopyLink,
            onOpenInBrowser,
            onSummarize,
            onTranslate,
            onWebModeChange,
            initialWebMode = false,
        },
        ref
    ) => {
        const [webModeEnabled, setWebModeEnabled] = useState(initialWebMode);

        const handleWebModeToggle = useCallback(
            (value: boolean) => {
                setWebModeEnabled(value);
                onWebModeChange?.(value);
            },
            [onWebModeChange]
        );

        const renderBackdrop = useCallback(
            (props: any) => (
                <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
            ),
            []
        );

        const menuItems = [
            {
                icon: 'solar:link-bold',
                label: 'Copy Link',
                onPress: onCopyLink,
            },
            {
                icon: 'solar:square-top-down-bold',
                label: 'Open in Browser',
                onPress: onOpenInBrowser,
            },
            {
                icon: 'solar:document-text-bold',
                label: 'Generate Summary',
                onPress: onSummarize,
            },
            {
                icon: 'lucide:languages',
                label: 'Translate',
                onPress: onTranslate,
            },
        ];

        return (
            <BottomSheetModal
                ref={ref}
                snapPoints={['40%']}
                enablePanDownToClose
                backdropComponent={renderBackdrop}
                backgroundStyle={{ backgroundColor: '#FFFFFF' }}
                handleIndicatorStyle={{ backgroundColor: '#E0E0E0', width: 40 }}>
                <BottomSheetView className="flex-1 px-6 py-4">
                    <Text className="mb-4 font-geist-semibold text-lg text-black">Article Options</Text>

                    {/* Menu Items */}
                    {menuItems.map((item, index) => (
                        <Pressable
                            key={item.label}
                            onPress={() => {
                                item.onPress?.();
                                // @ts-ignore - ref typing
                                ref?.current?.dismiss();
                            }}
                            className="flex-row items-center gap-4 py-4"
                            style={{ borderTopWidth: index > 0 ? 0.5 : 0, borderTopColor: '#F0F0F0' }}>
                            <Monicon name={item.icon} size={24} color="#232222" />
                            <Text className="flex-1 font-geist text-base text-black">{item.label}</Text>
                        </Pressable>
                    ))}

                    {/* Web Mode Toggle */}
                    <View
                        className="flex-row items-center justify-between py-4"
                        style={{ borderTopWidth: 0.5, borderTopColor: '#F0F0F0' }}>
                        <View className="flex-row items-center gap-4">
                            <Monicon name="solar:global-bold" size={24} color="#232222" />
                            <Text className="font-geist text-base text-black">Web Mode</Text>
                        </View>
                        <Switch value={webModeEnabled} onValueChange={handleWebModeToggle} />
                    </View>
                </BottomSheetView>
            </BottomSheetModal>
        );
    }
);

ArticleMenuModal.displayName = 'ArticleMenuModal';

