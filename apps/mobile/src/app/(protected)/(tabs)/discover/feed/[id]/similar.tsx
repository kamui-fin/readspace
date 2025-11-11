import { FeedListItem } from '@/components/FeedListItem';
import { FolderPicker, type FolderPickerRef } from '@/components/FolderPicker';
import { FeedListSkeleton } from '@/components/skeletons';
import { COLORS } from '@/constants/Colors';
import { LegendList } from '@legendapp/list';
import { Monicon } from '@monicon/native';
import {
    ApiClient,
    useCreateFeed,
    type FeedDiscoveryResult,
    type SimilarFeedsResponse,
} from '@readspace/shared';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

export default function SimilarFeedsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const colorScheme = useColorScheme();
    const colors = COLORS[colorScheme ?? 'light'];
    const folderPickerRef = useRef<FolderPickerRef>(null);
    const [pendingFeedUrl, setPendingFeedUrl] = useState<string | null>(null);

    const createFeed = useCreateFeed();

    // Fetch the feed details to get the title
    const { data: feedData } = useQuery({
        queryKey: ['feed', id],
        queryFn: () => ApiClient.rss.getFeed(id),
        enabled: !!id,
    });

    // Fetch similar feeds data (full list)
    const {
        data: similarData,
        isLoading,
        error,
    } = useQuery<SimilarFeedsResponse>({
        queryKey: ['similar-feeds-full', id, 20],
        queryFn: () => ApiClient.rss.getSimilarFeeds(id, { limit: 20 }),
        enabled: !!id,
    });

    const similarFeeds = similarData?.similar_feeds || [];
    const feedTitle = feedData?.title || 'this feed';

    const handleBack = useCallback(() => {
        router.back();
    }, [router]);

    const handleFeedFollowRequest = useCallback((feedUrl: string) => {
        setPendingFeedUrl(feedUrl);
        folderPickerRef.current?.present();
    }, []);

    const handleFolderSelect = useCallback(
        (folderId: string | null) => {
            if (!pendingFeedUrl) {
                return;
            }

            createFeed.mutate(
                {
                    url: pendingFeedUrl,
                    folder_id: folderId || undefined,
                    silent: false,
                },
                {
                    onSuccess: () => {
                        setPendingFeedUrl(null);
                    },
                    onError: (error: any) => {
                        toast.error(error?.message || 'Failed to follow feed');
                        setPendingFeedUrl(null);
                    },
                }
            );
        },
        [pendingFeedUrl, createFeed]
    );

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-white-dark" edges={['top']}>
                <View className="border-b border-light-grey px-4 py-4 dark:border-light-grey-dark">
                    <View className="flex-row items-center gap-3">
                        <Pressable onPress={handleBack} className="active:opacity-70">
                            <Monicon
                                name="solar:arrow-left-linear"
                                size={24}
                                color={colors.primary_foreground}
                            />
                        </Pressable>
                        <Text className="font-geist-medium text-black dark:text-black-dark">
                            Feeds similar to {feedTitle}
                        </Text>
                    </View>
                </View>
                <View className="flex-1 px-6">
                    <FeedListSkeleton count={6} />
                </View>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-white-dark" edges={['top']}>
                <View className="border-b border-light-grey px-4 py-4 dark:border-light-grey-dark">
                    <View className="flex-row items-center gap-3">
                        <Pressable onPress={handleBack} className="active:opacity-70">
                            <Monicon
                                name="solar:arrow-left-linear"
                                size={24}
                                color={colors.primary_foreground}
                            />
                        </Pressable>
                        <Text className="font-geist-medium text-black dark:text-black-dark">
                            Feeds similar to {feedTitle}
                        </Text>
                    </View>
                </View>
                <View className="flex-1 items-center justify-center px-6">
                    <Text className="mb-4 text-center text-base text-grey dark:text-grey-dark">
                        Failed to load similar feeds
                    </Text>
                    <Pressable onPress={handleBack} className="rounded-full bg-primary px-4 py-2">
                        <Text className="font-geist-semibold text-white">Go Back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-white-dark" edges={['top']}>
            <View className="border-b border-light-grey px-4 py-4 dark:border-light-grey-dark">
                <View className="flex-row items-center gap-3">
                    <Pressable onPress={handleBack} className="active:opacity-70">
                        <Monicon
                            name="solar:arrow-left-linear"
                            size={24}
                            color={colors.primary_foreground}
                        />
                    </Pressable>
                    <Text className="font-geist-medium text-black dark:text-black-dark">
                        Feeds similar to {feedTitle}
                    </Text>
                </View>
            </View>

            {similarFeeds.length > 0 ? (
                <LegendList
                    data={similarFeeds}
                    estimatedItemSize={80}
                    renderItem={({ item, index }: { item: FeedDiscoveryResult; index: number }) => (
                        <View>
                            <FeedListItem
                                feedId={item.id}
                                feedUrl={item.url}
                                title={item.title || 'Untitled Feed'}
                                description={item.description || ''}
                                iconUrl={item.image_url || undefined}
                                isFollowing={item.is_subscribed || false}
                                className="px-6"
                                onFollowRequest={handleFeedFollowRequest}
                            />
                            {index < similarFeeds.length - 1 && (
                                <View className="mx-6 h-[0.5px] bg-light-grey dark:bg-mid-grey-dark" />
                            )}
                        </View>
                    )}
                    keyExtractor={(item: FeedDiscoveryResult) => item.id}
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                <View className="flex-1 items-center justify-center px-6">
                    <Monicon name="solar:document-text-linear" size={64} color="#D8D8D8" />
                    <Text className="mt-4 text-center font-geist-semibold text-lg text-black dark:text-black-dark">
                        No similar feeds found
                    </Text>
                    <Text className="mt-2 text-center font-geist text-base text-grey dark:text-grey-dark">
                        This feed might be unique, or similar feeds may not have embeddings yet.
                    </Text>
                </View>
            )}

            <FolderPicker ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
        </SafeAreaView>
    );
}
