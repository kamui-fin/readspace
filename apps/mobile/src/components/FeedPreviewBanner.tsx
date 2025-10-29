import { Button } from '@/components/ui/Button';
import { Monicon } from '@monicon/native';
import { Text, View } from 'react-native';

interface FeedPreviewBannerProps {
    feedTitle?: string;
    onFollow?: () => void;
}

export function FeedPreviewBanner({ feedTitle, onFollow }: FeedPreviewBannerProps) {
    return (
        <View className="w-full border-b border-light-grey dark:border-light-grey-dark bg-orange-50 dark:bg-orange-950 px-4 py-3">
            <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1 flex-row items-center gap-4">
                    <Monicon name="solar:eye-linear" size={18} color="#EA580C" />
                    <View className="flex-1">
                        <Text className="font-geist-semibold text-sm text-orange-700 dark:text-orange-400">
                            Preview Mode
                        </Text>
                        {feedTitle && (
                            <Text className="font-geist text-xs text-orange-600 dark:text-orange-500" numberOfLines={1}>
                                You are not yet subscribed to this feed
                            </Text>
                        )}
                    </View>
                </View>
                {onFollow && (
                    <Button
                        onPress={onFollow}
                        variant="secondary"
                        className="h-8 flex-row items-center gap-1.5 bg-orange-600 dark:bg-orange-700 px-3">
                        <Monicon name="solar:bell-outline" size={16} color="#FFFFFF" />
                        <Text className="font-geist-semibold text-sm text-white dark:text-white-dark">Follow</Text>
                    </Button>
                )}
            </View>
        </View>
    );
}
