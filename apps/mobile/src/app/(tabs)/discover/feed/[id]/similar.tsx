import { FeedListItem } from '@/components/FeedListItem';
import { FolderPicker, type FolderPickerRef } from '@/components/FolderPicker';
import { FeedListSkeleton } from '@/components/skeletons';
import { Monicon } from '@monicon/native';
import { ApiClient, useCreateFeed, type SimilarFeedsResponse } from '@readspace/shared';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

export default function SimilarFeedsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const folderPickerRef = useRef<FolderPickerRef>(null);
    const [pendingFeedUrl, setPendingFeedUrl] = useState<string | null>(null);

    const createFeed = useCreateFeed();

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

    const sourceFeed = similarData?.source_feed;
    const similarFeeds = similarData?.similar_feeds || [];

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
                        // Button state changes to "Following", no toast needed
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
            <SafeAreaView className="flex-1 bg-white" edges={['top']}>
                <View className="px-6 pb-4 pt-2">
                    <Pressable
                        onPress={handleBack}
                        className="mb-6 h-10 w-10 items-center justify-center rounded-full active:bg-mid-grey">
                        <Monicon name="solar:alt-arrow-left-linear" size={24} color="#232222" />
                    </Pressable>

                    {/* Title */}
                    <View className="mb-2 h-8 w-48 rounded-md bg-mid-grey" />

                    {/* Source Feed Info Skeleton */}
                    <View className="mt-4 rounded-2xl bg-light-grey p-4">
                        <View className="mb-2 h-4 w-32 rounded bg-mid-grey" />
                        <View className="flex-row items-center gap-3">
                            <View className="h-10 w-10 rounded-lg bg-mid-grey" />
                            <View className="h-5 flex-1 rounded bg-mid-grey" />
                        </View>
                    </View>
                </View>

                {/* Feed List Skeleton */}
                <View className="flex-1 px-6">
                    <FeedListSkeleton count={6} />
                </View>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView className="flex-1 bg-white" edges={['top']}>
                <View className="px-6 pt-2">
                    <Pressable
                        onPress={handleBack}
                        className="mb-6 h-10 w-10 items-center justify-center rounded-full active:bg-mid-grey">
                        <Monicon name="solar:alt-arrow-left-linear" size={24} color="#232222" />
                    </Pressable>
                </View>
                <View className="flex-1 items-center justify-center px-6">
                    <Text className="mb-4 text-center text-base text-grey">
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
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
            <View className="flex-1">
                {/* Header */}
                <View className="px-6 pb-4 pt-2">
                    <Pressable
                        onPress={handleBack}
                        className="mb-6 h-10 w-10 items-center justify-center rounded-full active:bg-mid-grey">
                        <Monicon name="solar:alt-arrow-left-linear" size={24} color="#232222" />
                    </Pressable>

                    {/* Title */}
                    <Text className="mb-2 font-geist-bold text-2xl text-black">Similar Feeds</Text>

                    {/* Source Feed Info */}
                    {sourceFeed && (
                        <View className="mt-4 rounded-2xl bg-light-grey p-4">
                            <Text className="mb-2 font-geist text-sm text-grey">
                                Feeds similar to:
                            </Text>
                            <View className="flex-row items-center gap-3">
                                {sourceFeed.image_url ? (
                                    <Image
                                        source={{ uri: sourceFeed.image_url }}
                                        className="h-10 w-10 rounded-lg"
                                    />
                                ) : (
                                    <View className="h-10 w-10 items-center justify-center rounded-lg bg-mid-grey">
                                        <Text className="font-geist-bold text-base text-grey">
                                            {(sourceFeed.title || 'F').charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                )}
                                <Text className="flex-1 font-geist-semibold text-base text-black">
                                    {sourceFeed.title || 'Untitled Feed'}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Similar Feeds List */}
                {similarFeeds.length > 0 ? (
                    <FlatList
                        data={similarFeeds}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
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
                        )}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        showsVerticalScrollIndicator={false}
                    />
                ) : (
                    <View className="flex-1 items-center justify-center px-6">
                        <Monicon name="solar:document-text-linear" size={64} color="#D8D8D8" />
                        <Text className="mt-4 text-center font-geist-semibold text-lg text-black">
                            No similar feeds found
                        </Text>
                        <Text className="mt-2 text-center font-geist text-base text-grey">
                            This feed might be unique, or similar feeds may not have embeddings yet.
                        </Text>
                    </View>
                )}
            </View>

            {/* Folder Picker Bottom Sheet - Shared across all feed items */}
            <FolderPicker ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
        </SafeAreaView>
    );
}
