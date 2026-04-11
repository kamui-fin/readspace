import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { BottomSheetInput } from '@components/ui/input';
import { toast } from '@components/ui/toast';
import { Text } from '@components/ui/text';
import { BottomSheetFooter, type BottomSheetModal } from '@gorhom/bottom-sheet';
import { BUTTON_BORDER_RADIUS } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { ApiClient, type FeedDiscoveryResult } from '@readspace/shared';
import { useMutation } from '@tanstack/react-query';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface AddFeedBottomSheetRef {
    present: () => void;
    dismiss: () => void;
}

export interface AddFeedBottomSheetProps {
    onConfirm: (url: string) => void;
}

export const AddFeedBottomSheet = forwardRef<AddFeedBottomSheetRef, AddFeedBottomSheetProps>(
    ({ onConfirm }, ref) => {
        const bottomSheetRef = useRef<BottomSheetModal>(null);
        const [url, setUrl] = useState('');
        const [feedPreview, setFeedPreview] = useState<FeedDiscoveryResult | null>(null);
        const isDark = useIsDarkMode();
        const colors = COLORS[isDark ? 'dark' : 'light'];
        const insets = useSafeAreaInsets();

        const { mutate: previewUrl, isPending: isPreviewing } = useMutation({
            mutationFn: (searchUrl: string) => ApiClient.previewFeed(searchUrl),
            onSuccess: (data) => {
                setFeedPreview(data);
            },
            onError: () => {
                toast.error('Could not find a valid RSS feed at this URL.');
                setFeedPreview(null);
            },
        });

        const handlePreview = useCallback(() => {
            const trimmed = url.trim();
            if (!trimmed) return;
            previewUrl(trimmed);
        }, [url, previewUrl]);

        const handleConfirm = useCallback(() => {
            const trimmed = url.trim();
            if (!trimmed) return;
            onConfirm(trimmed);
            bottomSheetRef.current?.dismiss();
            setUrl('');
            setFeedPreview(null);
        }, [url, onConfirm]);

        useImperativeHandle(ref, () => ({
            present: () => {
                setUrl('');
                setFeedPreview(null);
                bottomSheetRef.current?.present();
            },
            dismiss: () => {
                bottomSheetRef.current?.dismiss();
            },
        }));

        // Generate fallback avatar
        const fallbackTitle = feedPreview?.title || url;
        const fallbackAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackTitle)}&size=128&background=random&length=2&bold=true&format=png`;

        const renderFooter = useCallback(
            (props: any) => (
                <BottomSheetFooter {...props} bottomInset={0}>
                    <View
                        className="bg-background px-6 pt-4"
                        style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
                        {!feedPreview ? (
                            <Button
                                variant="primary"
                                size="large"
                                fullWidth
                                onPress={handlePreview}
                                disabled={!url.trim() || isPreviewing}
                                style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
                                Preview
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                size="large"
                                fullWidth
                                onPress={handleConfirm}
                                style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
                                Confirm
                            </Button>
                        )}
                    </View>
                </BottomSheetFooter>
            ),
            [insets.bottom, feedPreview, url, isPreviewing, handlePreview, handleConfirm]
        );

        return (
            <BottomSheet
                ref={bottomSheetRef}
                enablePanDownToClose={true}
                snapPoints={['50%', '80%']}
                enableDynamicSizing={false}
                keyboardBehavior="interactive"
                keyboardBlurBehavior="restore"
                footerComponent={renderFooter}>
                <Text
                    className="font-geist-bold text-2xl text-primary-foreground dark:text-primary-foreground-dark mb-1"
                    style={{ letterSpacing: -0.5 }}>
                    Add feed
                </Text>
                <Text className="font-geist-regular text-base text-grey dark:text-grey mb-5">
                    Enter an RSS feed URL to subscribe.
                </Text>

                <BottomSheetInput
                    value={url}
                    onChangeText={(val) => {
                        setUrl(val);
                        if (feedPreview) setFeedPreview(null);
                    }}
                    placeholder="https://example.com/feed.xml"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="search"
                    onSubmitEditing={handlePreview}
                    borderRadius={14}
                    editable={!isPreviewing}
                />

                {isPreviewing && (
                    <View className="mt-6 items-center justify-center">
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text className="font-geist mt-2 text-sm text-grey dark:text-grey">Finding feed...</Text>
                    </View>
                )}

                {!isPreviewing && feedPreview && (
                    <View className="mt-5 p-4 rounded-xl border border-divider bg-grey6 flex-row items-center gap-4">
                        <View
                            className="h-12 w-12 items-center justify-center overflow-hidden rounded-lg"
                            style={{ backgroundColor: colors.grey5 }}>
                            {feedPreview.image_url ? (
                                <Image source={{ uri: feedPreview.image_url }} className="h-full w-full" resizeMode="cover" />
                            ) : (
                                <Image source={{ uri: fallbackAvatarUrl }} className="h-full w-full" resizeMode="cover" />
                            )}
                        </View>
                        <View className="flex-1">
                            <Text size="base" fontFamily="geist-semibold" className="text-black mb-1 tracking-tight" numberOfLines={1}>
                                {feedPreview.title || 'Untitled Feed'}
                            </Text>
                            {feedPreview.description ? (
                                <Text size="sm" fontFamily="geist" className="text-grey" numberOfLines={2}>
                                    {feedPreview.description}
                                </Text>
                            ) : null}
                        </View>
                    </View>
                )}

            </BottomSheet>
        );
    }
);

AddFeedBottomSheet.displayName = 'AddFeedBottomSheet';
