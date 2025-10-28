import { ArticleListItem } from '@/components/ArticleListItem';
import { FeedListItem } from '@/components/FeedListItem';
import { FolderPicker } from '@/components/FolderPicker';
import { FeedPreviewSkeleton } from '@/components/skeletons';
import { ShimmerView } from '@/components/skeletons/ShimmerView';
import { Button } from '@/components/ui/Button';
import { useFeedViewStore } from '@/stores/feed-view';
import BottomSheet from '@gorhom/bottom-sheet';
import { Monicon } from '@monicon/native';
import {
    ApiClient,
    useCreateFeed,
    useDeleteFeed,
    useFeed,
    type Article,
    type FeedDiscoveryResult,
    type SimilarFeedsResponse,
} from '@readspace/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    Linking,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.7;
const CARD_SPACING = 16;

export default function FeedPreviewScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const folderPickerRef = useRef<BottomSheet>(null);
    const [pendingSimilarFeedUrl, setPendingSimilarFeedUrl] = useState<string | null>(null);
    const [isPreviewRefreshing, setIsPreviewRefreshing] = useState(false);
    const [previewFeedData, setPreviewFeedData] = useState<FeedDiscoveryResult | null>(null);

    // Ref to track if preview refresh has already been triggered
    const hasRefreshedPreview = useRef(false);

    const queryClient = useQueryClient();

    // Fetch feed data - disable if we're doing preview refresh
    const { data: fetchedFeedData, isLoading: isFeedLoading } = useFeed(id || '', {
        enabled: !!id && !isPreviewRefreshing,
    });

    // Use preview feed data if available, otherwise use fetched data
    const feed = previewFeedData || fetchedFeedData;

    // Determine if we should show preview mode (feed is not subscribed)
    const shouldShowPreviewBanner = !!(feed && feed.is_subscribed === false);

    // Fetch preview articles for the feed
    const { data: articlesData, isLoading: isArticlesLoading, refetch: refetchArticles } = useQuery<{
        items: Article[];
        total: number;
    }>({
        queryKey: ['feed-articles', id],
        queryFn: async () => {
            const response = await ApiClient.rss.getArticles({
                feed_ids: [id],
                size: 5,
            });
            return response;
        },
        enabled: !!id,
    });

    // Fetch similar feeds (top 4 for preview)
    const { data: similarData, isLoading: isSimilarLoading } = useQuery<SimilarFeedsResponse>({
        queryKey: ['similar-feeds-preview', id, 4],
        queryFn: () => ApiClient.rss.getSimilarFeeds(id, { limit: 4 }),
        enabled: !!id,
    });

    const createFeed = useCreateFeed();
    const deleteFeed = useDeleteFeed();

    const articles = articlesData?.items || [];
    const similarFeeds = similarData?.similar_feeds || [];
    const isFollowing = feed?.is_subscribed || false;

    // Preview mode: refresh feed on mount to get latest articles
    useEffect(() => {
        if (shouldShowPreviewBanner && id && !hasRefreshedPreview.current) {
            hasRefreshedPreview.current = true;
            setIsPreviewRefreshing(true);

            // Call API directly with preview=true parameter
            ApiClient.rss
                .refreshFeed(id, true, true)
                .then((feedData) => {
                    // Store the feed data from refresh response
                    setPreviewFeedData(feedData);
                    // Trigger articles refetch
                    refetchArticles();
                })
                .catch((error) => {
                    console.error('Preview refresh failed:', error);
                })
                .finally(() => {
                    setIsPreviewRefreshing(false);
                });
        }
    }, [shouldShowPreviewBanner, id, refetchArticles]);

    const handleBack = useCallback(() => {
        router.back();
    }, [router]);

    const handleFollowPress = useCallback(() => {
        if (isFollowing && feed?.id) {
            // Unfollow
            deleteFeed.mutate(
                { feedId: feed.id, silent: false },
                {
                    onSuccess: () => {
                        toast.success('Unfollowed feed');
                    },
                    onError: () => {
                        toast.error('Failed to unfollow feed');
                    },
                }
            );
        } else {
            // Show folder picker to follow
            folderPickerRef.current?.expand();
        }
    }, [isFollowing, feed, deleteFeed]);

    const handleSimilarFeedFollowRequest = useCallback((feedUrl: string) => {
        setPendingSimilarFeedUrl(feedUrl);
        folderPickerRef.current?.expand();
    }, []);

    const handleFolderSelect = useCallback(
        (folderId: string | null) => {
            // Determine which feed to follow: main feed or a similar feed
            const feedUrlToFollow = pendingSimilarFeedUrl || feed?.url;

            if (!feedUrlToFollow) {
                toast.error('Feed URL is missing');
                return;
            }

            createFeed.mutate(
                {
                    url: feedUrlToFollow,
                    folder_id: folderId || undefined,
                    silent: false,
                },
                {
                    onSuccess: () => {
                        toast.success(pendingSimilarFeedUrl ? 'Following feed!' : `Following ${feed?.title}`);
                        setPendingSimilarFeedUrl(null);
                    },
                    onError: (error: any) => {
                        toast.error(error?.message || 'Failed to follow feed');
                        setPendingSimilarFeedUrl(null);
                    },
                }
            );
        },
        [feed, createFeed, pendingSimilarFeedUrl]
    );

    const handleUrlPress = useCallback(async () => {
        if (!feed?.link && !feed?.url) return;
        const url = feed.link || feed.url;
        const fullUrl = url.startsWith('http') ? url : `https://${url}`;
        const supported = await Linking.canOpenURL(fullUrl);
        if (supported) {
            await Linking.openURL(fullUrl);
        } else {
            toast.error('Cannot open this URL');
        }
    }, [feed]);

    const handleArticlePress = useCallback(
        (articleId: string) => {
            router.push(`/articles/${articleId}`);
        },
        [router]
    );

    const handleSeeAllSimilar = useCallback(() => {
        router.push(`/discover/feed/${id}/similar`);
    }, [router, id]);

    const toggleDescription = useCallback(() => {
        setIsDescriptionExpanded((prev) => !prev);
    }, []);

    // Only show full skeleton during initial feed loading, not during preview refresh
    if (isFeedLoading && !isPreviewRefreshing) {
        return (
            <SafeAreaView className="flex-1 bg-white" edges={['top']}>
                <FeedPreviewSkeleton />
            </SafeAreaView>
        );
    }

    if (!feed) {
        return (
            <SafeAreaView className="flex-1 bg-white" edges={['top']}>
                <View className="flex-1 items-center justify-center px-6">
                    <Text className="text-center text-base text-grey">Feed not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <>
            <SafeAreaView className="flex-1 bg-white" edges={['top']}>
                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Header */}
                    <View className="px-6 pb-4 pt-2">
                        <Pressable
                            onPress={handleBack}
                            className="mb-6 h-10 w-10 items-center justify-center rounded-full active:bg-mid-grey">
                            <Monicon name="solar:alt-arrow-left-linear" size={24} color="#232222" />
                        </Pressable>

                        {/* Feed Icon */}
                        <View className="mb-4 h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border-2 border-light-grey bg-white">
                            {feed.image_url ? (
                                <Image
                                    source={{ uri: feed.image_url }}
                                    className="h-full w-full"
                                    resizeMode="cover"
                                />
                            ) : (
                                <Text className="font-geist-bold text-3xl text-grey">
                                    {feed.title.charAt(0).toUpperCase()}
                                </Text>
                            )}
                        </View>

                        {/* Feed Title */}
                        <Text
                            style={{ letterSpacing: -0.48 }}
                            className="mb-2 font-geist-bold text-2xl text-black">
                            {feed.title}
                        </Text>

                        {/* Feed Description */}
                        {feed.description && (
                            <View className="mb-4">
                                <Text className="font-geist text-base leading-6 text-grey">
                                    {isDescriptionExpanded
                                        ? feed.description
                                        : `${feed.description.slice(0, 80)}... `}
                                    {!isDescriptionExpanded && (
                                        <Text
                                            onPress={toggleDescription}
                                            className="font-geist-medium text-base text-black">
                                            more
                                        </Text>
                                    )}
                                </Text>
                                {isDescriptionExpanded && (
                                    <Pressable onPress={toggleDescription}>
                                        <Text className="mt-1 font-geist-medium text-base text-black">
                                            less
                                        </Text>
                                    </Pressable>
                                )}
                            </View>
                        )}

                        {/* Feed URL */}
                        {(feed.link || feed.url) && (
                            <Pressable
                                onPress={handleUrlPress}
                                className="mb-4 flex-row items-center gap-2">
                                <Monicon
                                    name="solar:link-circle-linear"
                                    size={20}
                                    color="#386641"
                                />
                                <Text className="font-geist text-sm text-primary underline flex-1 flex-shrink" numberOfLines={1}>
                                    {feed.link || feed.url}
                                </Text>
                            </Pressable>
                        )}

                        {/* Feed Tags */}
                        {feed.tags && feed.tags.length > 0 && (
                            <View className="mb-6 flex-row items-center gap-2 flex-wrap">
                                {feed.tags.slice(0, 5).map((tag) => (
                                    <View key={tag} className="flex-row items-center gap-1.5 rounded-full bg-mid-grey px-3 py-1.5">
                                        <Monicon
                                            name="solar:tag-linear"
                                            size={14}
                                            color="#90988B"
                                        />
                                        <Text className="font-geist text-xs text-grey">
                                            {typeof tag === 'object' ? tag.name : tag}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Follow Button */}
                        <Button
                            onPress={handleFollowPress}
                            variant={isFollowing ? 'secondary' : 'primary'}
                            fullWidth
                            disabled={createFeed.isPending || deleteFeed.isPending}
                            className="flex-row gap-2">
                            <Monicon
                                name={isFollowing ? 'solar:bell-bold' : 'solar:bell-outline'}
                                size={20}
                                color={isFollowing ? '#90988B' : '#FFFFFF'}
                            />
                            <Text
                                className={`font-geist-semibold text-base ${isFollowing ? 'text-grey' : 'text-white'
                                    }`}>
                                {createFeed.isPending || deleteFeed.isPending
                                    ? '...'
                                    : isFollowing
                                        ? 'Following'
                                        : 'Follow'}
                            </Text>
                        </Button>
                    </View>

                    {/* Divider */}
                    <View className="mb-6 h-2 bg-light-grey" />

                    {/* Recent Articles */}
                    <View className="mb-6">
                        <View className="mb-5 flex-row items-center justify-between px-6">
                            <Text
                                style={{ letterSpacing: -0.36 }}
                                className="font-geist-bold text-lg text-black">
                                Recent articles
                            </Text>
                            {shouldShowPreviewBanner && feed && (
                                <Pressable
                                    onPress={() => {
                                        // Navigate to Following screen with feed preview mode
                                        const { selectFeedPreview } = useFeedViewStore.getState();
                                        selectFeedPreview(feed.id, feed.title);
                                        router.push('/(tabs)/');
                                    }}
                                    className="h-9 w-9 items-center justify-center rounded-full bg-mid-grey active:opacity-60">
                                    <Monicon
                                        name="solar:alt-arrow-right-linear"
                                        size={18}
                                        color="#90988B"
                                    />
                                </Pressable>
                            )}
                        </View>

                        {isArticlesLoading || isPreviewRefreshing ? (
                            <FlatList
                                data={[1, 2, 3]}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 24 }}
                                renderItem={() => (
                                    <View
                                        className="overflow-hidden rounded-2xl border border-light-grey bg-white"
                                        style={{ width: CARD_WIDTH, marginRight: CARD_SPACING }}>
                                        <ShimmerView width={CARD_WIDTH} height={192} borderRadius={0} />
                                        <View className="p-4" style={{ width: CARD_WIDTH }}>
                                            <View className="mb-2 flex-row items-center gap-2">
                                                <ShimmerView width={6} height={6} borderRadius={3} />
                                                <ShimmerView width={64} height={12} borderRadius={4} />
                                            </View>
                                            <View className="gap-1.5">
                                                <ShimmerView width="100%" height={16} borderRadius={4} />
                                                <ShimmerView width="90%" height={16} borderRadius={4} />
                                                <ShimmerView width="70%" height={16} borderRadius={4} />
                                            </View>
                                        </View>
                                    </View>
                                )}
                                keyExtractor={(item) => item.toString()}
                            />
                        ) : articles.length > 0 ? (
                            <FlatList
                                data={articles}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 24 }}
                                renderItem={({ item: article }) => (
                                    <ArticleListItem
                                        variant="card"
                                        width={CARD_WIDTH}
                                        source={previewFeedData?.title || 'Unknown'}
                                        timestamp={
                                            article.published_at
                                                ? new Date(article.published_at).toLocaleDateString()
                                                : 'Unknown date'
                                        }
                                        title={article.title}
                                        description={article.description ?? undefined}
                                        imageUrl={article.image_url ?? undefined}
                                        onPress={() => handleArticlePress(article.id)}
                                        style={{ marginRight: CARD_SPACING }}
                                    />
                                )}
                                keyExtractor={(item) => item.id}
                            />
                        ) : (
                            <View className="px-6 py-8">
                                <Text className="text-center text-grey">
                                    No recent articles available
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Divider */}
                    <View className="mb-6 h-2 bg-light-grey" />

                    {/* You might also like */}
                    {similarFeeds.length > 0 && (
                        <View className="px-6 pb-8">
                            <View className="mb-5 flex-row items-center justify-between">
                                <Text
                                    style={{ letterSpacing: -0.36 }}
                                    className="font-geist-bold text-lg text-black">
                                    You might also like
                                </Text>
                                <Pressable
                                    onPress={handleSeeAllSimilar}
                                    className="h-9 w-9 items-center justify-center rounded-full bg-mid-grey active:opacity-60">
                                    <Monicon
                                        name="solar:alt-arrow-right-linear"
                                        size={18}
                                        color="#90988B"
                                    />
                                </Pressable>
                            </View>

                            {isSimilarLoading ? (
                                <View className="space-y-4">
                                    {Array.from({ length: 3 }).map((_, index) => (
                                        <View key={index} className="flex-row gap-3 py-3">
                                            <View className="h-14 w-14 rounded-lg bg-mid-grey" />
                                            <View className="flex-1 gap-2">
                                                <View className="h-4 w-3/4 rounded bg-mid-grey" />
                                                <View className="h-3 w-full rounded bg-mid-grey" />
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <View>
                                    {similarFeeds.map((suggestedFeed: FeedDiscoveryResult) => (
                                        <FeedListItem
                                            key={suggestedFeed.id}
                                            feedId={suggestedFeed.id}
                                            feedUrl={suggestedFeed.url}
                                            title={suggestedFeed.title || 'Untitled Feed'}
                                            description={suggestedFeed.description || ''}
                                            iconUrl={suggestedFeed.image_url || undefined}
                                            isFollowing={suggestedFeed.is_subscribed || false}
                                            onFollowRequest={handleSimilarFeedFollowRequest}
                                        />
                                    ))}
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>

            {/* Folder Picker Bottom Sheet - Shared for main feed and similar feeds */}
            <FolderPicker ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
        </>
    );
}
