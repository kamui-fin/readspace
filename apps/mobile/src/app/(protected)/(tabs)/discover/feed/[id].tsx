import { ArticleListItem } from '@/components/ArticleListItem';
import { FeedListItem } from '@/components/FeedListItem';
import { FolderPicker, type FolderPickerRef } from '@/components/FolderPicker';
import { FeedPreviewSkeleton } from '@/components/skeletons';
import { ShimmerView } from '@/components/skeletons/ShimmerView';
import { Button } from '@/components/ui/Button';
import { useFeedViewStore } from '@/stores/feed-view';
import { Monicon } from '@monicon/native';
import {
    ApiClient,
    formatRelativeDate,
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
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    Linking,
    Pressable,
    ScrollView,
    Text,
    useColorScheme,
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
    const folderPickerRef = useRef<FolderPickerRef>(null);
    const [pendingSimilarFeedUrl, setPendingSimilarFeedUrl] = useState<string | null>(null);
    const [isPreviewRefreshing, setIsPreviewRefreshing] = useState(false);
    const [previewFeedData, setPreviewFeedData] = useState<FeedDiscoveryResult | null>(null);
    const colorScheme = useColorScheme();

    // Local state to track subscription status for immediate UI updates
    const [localIsSubscribed, setLocalIsSubscribed] = useState<boolean | null>(null);

    // Ref to track if preview refresh has already been triggered
    const hasRefreshedPreview = useRef(false);
    // State to track if we need to wait for preview refresh before showing articles
    const [shouldWaitForPreview, setShouldWaitForPreview] = useState(false);

    const queryClient = useQueryClient();

    // Fetch feed data - disable if we're doing preview refresh
    const { data: fetchedFeedData, isLoading: isFeedLoading } = useFeed(id || '', {
        enabled: !!id && !isPreviewRefreshing,
    });

    // Use preview feed data if available, otherwise use fetched data
    const feed = previewFeedData || fetchedFeedData;

    // Sync local subscription state with feed data
    useEffect(() => {
        if (feed?.is_subscribed !== undefined && localIsSubscribed === null) {
            setLocalIsSubscribed(feed.is_subscribed);
        }
    }, [feed?.is_subscribed, localIsSubscribed]);

    // Determine if we should show preview mode (feed is not subscribed)
    const shouldShowPreviewBanner = !!(feed && feed.is_subscribed === false);

    // Fetch preview articles for the feed
    // Don't fetch articles until preview refresh is done (if in preview mode)
    const {
        data: articlesData,
        isLoading: isArticlesLoading,
        refetch: refetchArticles,
    } = useQuery({
        queryKey: ['feed-articles', id],
        queryFn: async () => {
            const response = await ApiClient.rss.getArticles({
                feed_ids: [id],
                limit: 5,
            });
            return response;
        },
        enabled: !!id && !shouldWaitForPreview,
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
    // Use local state if available, otherwise fall back to feed data
    const isFollowing =
        localIsSubscribed !== null ? localIsSubscribed : feed?.is_subscribed || false;

    // Check if feed is dead (no articles published in last 6 months)
    const isFeedDead =
        articles.length > 0 && articles[0].published_at
            ? new Date().getTime() - new Date(articles[0].published_at).getTime() >
              6 * 30 * 24 * 60 * 60 * 1000
            : false;

    // Preview mode: refresh feed on mount to get latest articles
    useEffect(() => {
        if (shouldShowPreviewBanner && id && !hasRefreshedPreview.current) {
            hasRefreshedPreview.current = true;
            setShouldWaitForPreview(true);
            setIsPreviewRefreshing(true);

            // Call API directly with preview=true parameter
            ApiClient.rss
                .refreshFeed(id, true, true)
                .then(async (feedData) => {
                    // Store the feed data from refresh response (cast to FeedDiscoveryResult)
                    setPreviewFeedData(feedData as unknown as FeedDiscoveryResult);
                    // Enable articles query and trigger refetch
                    setShouldWaitForPreview(false);
                    // Wait for articles to be fetched before hiding loading state
                    await refetchArticles();
                })
                .catch((error) => {
                    console.error('Preview refresh failed:', error);
                    // Enable articles query even on error
                    setShouldWaitForPreview(false);
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
            // Immediately update local state
            setLocalIsSubscribed(false);

            // Unfollow
            deleteFeed.mutate(
                { feedId: feed.id, silent: false },
                {
                    onSuccess: () => {
                        toast.success('Unfollowed feed');
                    },
                    onError: () => {
                        toast.error('Failed to unfollow feed');
                        // Rollback on error
                        setLocalIsSubscribed(true);
                    },
                }
            );
        } else {
            // Show folder picker to follow
            folderPickerRef.current?.present();
        }
    }, [isFollowing, feed, deleteFeed]);

    const handleSimilarFeedFollowRequest = useCallback((feedUrl: string) => {
        setPendingSimilarFeedUrl(feedUrl);
        folderPickerRef.current?.present();
    }, []);

    const handleFolderSelect = useCallback(
        (folderId: string | null) => {
            // Determine which feed to follow: main feed or a similar feed
            const feedUrlToFollow = pendingSimilarFeedUrl || feed?.url;

            if (!feedUrlToFollow) {
                toast.error('Feed URL is missing');
                return;
            }

            // Immediately update local state if following the current feed
            if (!pendingSimilarFeedUrl) {
                setLocalIsSubscribed(true);
            }

            createFeed.mutate(
                {
                    url: feedUrlToFollow,
                    folder_id: folderId || undefined,
                    silent: false,
                },
                {
                    onSuccess: (data) => {
                        toast.success(
                            pendingSimilarFeedUrl ? 'Following feed!' : `Following ${feed?.title}`
                        );
                        setPendingSimilarFeedUrl(null);

                        // If we just followed the current feed (not a similar feed)
                        if (!pendingSimilarFeedUrl && feed?.id) {
                            // Invalidate the feed cache to ensure the Following screen gets updated data
                            queryClient.invalidateQueries({
                                queryKey: ['feeds', feed.id],
                            });

                            // Update the feed view store to exit preview mode
                            const { selectFeed } = useFeedViewStore.getState();
                            selectFeed(feed.id, feed.title || 'Feed');
                        }
                    },
                    onError: (error: any) => {
                        toast.error(error?.message || 'Failed to follow feed');
                        setPendingSimilarFeedUrl(null);

                        // Rollback local state on error
                        if (!pendingSimilarFeedUrl) {
                            setLocalIsSubscribed(false);
                        }
                    },
                }
            );
        },
        [feed, createFeed, pendingSimilarFeedUrl, queryClient]
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
            // Pass subscription status to article screen
            const isSubscribed = feed?.is_subscribed ?? false;
            router.push(`/(protected)/articles/${articleId}?isSubscribed=${isSubscribed}`);
        },
        [router, feed?.is_subscribed]
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
            <SafeAreaView className="flex-1 bg-white dark:bg-white-dark" edges={['top']}>
                <FeedPreviewSkeleton />
            </SafeAreaView>
        );
    }

    if (!feed) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-white-dark" edges={['top']}>
                <View className="flex-1 items-center justify-center px-6">
                    <Text className="text-center text-base text-grey dark:text-grey-dark">
                        Feed not found
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <>
            <SafeAreaView className="flex-1 bg-white dark:bg-white-dark" edges={['top']}>
                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Header */}
                    <View className="px-6 pb-4 pt-2">
                        <Pressable
                            onPress={handleBack}
                            className="mb-6 h-10 w-10 items-center justify-center rounded-full active:bg-mid-grey dark:active:bg-mid-grey-dark">
                            <Monicon
                                name="solar:arrow-left-linear"
                                size={24}
                                color={colorScheme === 'dark' ? '#FFFFFF' : '#232222'}
                            />
                        </Pressable>

                        {/* Feed Icon */}
                        <View className="relative mb-4">
                            <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border-2 border-light-grey bg-white dark:border-light-grey-dark dark:bg-white-dark">
                                {feed.image_url ? (
                                    <Image
                                        source={{ uri: feed.image_url }}
                                        className="h-full w-full"
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <Text className="font-geist-bold text-3xl text-grey dark:text-grey-dark">
                                        {(feed.title || 'F').charAt(0).toUpperCase()}
                                    </Text>
                                )}
                            </View>
                            {isFeedDead && (
                                <View className="absolute -right-1 -top-1 rounded-full border-2 border-white bg-red px-2.5 py-1 shadow-sm dark:border-white-dark">
                                    <Text className="font-geist-semibold text-xs text-white">
                                        Inactive
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Feed Title */}
                        <Text
                            style={{ letterSpacing: -0.48 }}
                            className="mb-2 font-geist-bold text-2xl text-black dark:text-black-dark">
                            {feed.title || 'Untitled Feed'}
                        </Text>

                        {/* Feed Description */}
                        {feed.description && (
                            <View className="mb-4">
                                {feed.description.length > 80 ? (
                                    <>
                                        <Text className="font-geist text-base leading-6 text-grey dark:text-grey-dark">
                                            {isDescriptionExpanded
                                                ? feed.description
                                                : `${feed.description.slice(0, 80)}... `}
                                            {!isDescriptionExpanded && (
                                                <Text
                                                    onPress={toggleDescription}
                                                    className="font-geist-medium text-base text-black dark:text-black-dark">
                                                    more
                                                </Text>
                                            )}
                                        </Text>
                                        {isDescriptionExpanded && (
                                            <Pressable onPress={toggleDescription}>
                                                <Text className="mt-1 font-geist-medium text-base text-black dark:text-black-dark">
                                                    less
                                                </Text>
                                            </Pressable>
                                        )}
                                    </>
                                ) : (
                                    <Text className="font-geist text-base leading-6 text-grey dark:text-grey-dark">
                                        {feed.description}
                                    </Text>
                                )}
                            </View>
                        )}

                        {/* Feed URL */}
                        {(feed.link || feed.url) && (
                            <Pressable
                                onPress={handleUrlPress}
                                className="mb-4 flex-row items-center gap-2">
                                <Monicon
                                    name="solar:link-minimalistic-2-bold"
                                    size={20}
                                    strokeWidth={2.4}
                                    color="#386641"
                                />
                                <Text
                                    className="flex-1 flex-shrink font-geist text-sm text-primary underline dark:text-primary"
                                    numberOfLines={1}>
                                    {feed.link || feed.url}
                                </Text>
                            </Pressable>
                        )}

                        {/* Feed Tags */}
                        {feed.tags && feed.tags.length > 0 && (
                            <View className="mb-6 flex-row flex-wrap items-center gap-2">
                                {feed.tags.slice(0, 5).map((tag, index) => {
                                    const tagName =
                                        typeof tag === 'string' ? tag : (tag as any)?.name || 'Tag';
                                    const formattedTag = tagName.replace(/\s+/g, '-');
                                    return (
                                        <View
                                            key={`${tagName}-${index.toString()}`}
                                            className="flex-row items-center gap-1.5 rounded-full bg-mid-grey px-3 py-1.5 dark:bg-mid-grey-dark">
                                            <Text className="font-geist text-xs text-grey dark:text-grey-dark">
                                                #{formattedTag}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        {/* Follow Button */}
                        <Button
                            onPress={handleFollowPress}
                            variant={isFollowing ? 'secondary' : 'primary'}
                            fullWidth
                            disabled={createFeed.isPending || deleteFeed.isPending}
                            className="flex-row gap-2">
                            {createFeed.isPending || deleteFeed.isPending ? (
                                <ActivityIndicator
                                    size="small"
                                    color={isFollowing ? '#90988B' : '#FFFFFF'}
                                />
                            ) : (
                                <Monicon
                                    name={
                                        isFollowing
                                            ? 'solar:trash-bin-minimalistic-2-bold'
                                            : 'solar:bell-outline'
                                    }
                                    size={20}
                                    color={isFollowing ? '#90988B' : '#FFFFFF'}
                                />
                            )}
                            <Text
                                className={`font-geist-semibold text-base ${
                                    isFollowing ? 'text-grey' : 'text-white'
                                }`}>
                                {createFeed.isPending
                                    ? 'Following...'
                                    : deleteFeed.isPending
                                      ? 'Unfollowing...'
                                      : isFollowing
                                        ? 'Unfollow'
                                        : 'Follow'}
                            </Text>
                        </Button>
                    </View>

                    {/* Recent Articles */}
                    <View className="mb-8 mt-8">
                        <View className="mb-5 flex-row items-center justify-between px-6">
                            <Text
                                style={{ letterSpacing: -0.36 }}
                                className="font-geist-bold text-lg text-black dark:text-black-dark">
                                Recent articles
                            </Text>
                            {feed && (
                                <Pressable
                                    onPress={() => {
                                        // Use isFollowing state which reflects the current subscription status
                                        if (!isFollowing) {
                                            // Navigate to Following screen with feed preview mode
                                            const { selectFeedPreview } =
                                                useFeedViewStore.getState();
                                            // Store the current route to return to when back is pressed
                                            selectFeedPreview(
                                                feed.id,
                                                feed.title || 'Feed',
                                                `/discover/feed/${feed.id}`
                                            );
                                        } else {
                                            // Navigate to Following screen with feed selected
                                            const { selectFeed } = useFeedViewStore.getState();
                                            selectFeed(feed.id, feed.title || 'Feed');
                                        }
                                        router.push('/(tabs)/' as any);
                                    }}
                                    className="h-9 w-9 items-center justify-center rounded-full bg-mid-grey active:opacity-60 dark:bg-mid-grey-dark">
                                    <Monicon
                                        name="solar:alt-arrow-right-linear"
                                        size={18}
                                        color="#90988B"
                                    />
                                </Pressable>
                            )}
                        </View>

                        {isArticlesLoading || isPreviewRefreshing || shouldWaitForPreview ? (
                            <FlatList
                                data={[1, 2, 3]}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 24 }}
                                renderItem={() => (
                                    <View
                                        className="overflow-hidden rounded-2xl border border-light-grey bg-white dark:border-light-grey-dark dark:bg-white-dark"
                                        style={{ width: CARD_WIDTH, marginRight: CARD_SPACING }}>
                                        <ShimmerView
                                            width={CARD_WIDTH}
                                            height={192}
                                            borderRadius={0}
                                        />
                                        <View className="p-4" style={{ width: CARD_WIDTH }}>
                                            <View className="mb-2 flex-row items-center gap-2">
                                                <ShimmerView
                                                    width={6}
                                                    height={6}
                                                    borderRadius={3}
                                                />
                                                <ShimmerView
                                                    width={64}
                                                    height={12}
                                                    borderRadius={4}
                                                />
                                            </View>
                                            <View className="gap-1.5">
                                                <ShimmerView
                                                    width="100%"
                                                    height={16}
                                                    borderRadius={4}
                                                />
                                                <ShimmerView
                                                    width="90%"
                                                    height={16}
                                                    borderRadius={4}
                                                />
                                                <ShimmerView
                                                    width="70%"
                                                    height={16}
                                                    borderRadius={4}
                                                />
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
                                snapToInterval={CARD_WIDTH + CARD_SPACING}
                                snapToAlignment="start"
                                decelerationRate="fast"
                                renderItem={({ item: article }) => (
                                    <ArticleListItem
                                        variant="card"
                                        width={CARD_WIDTH}
                                        source={previewFeedData?.title || feed?.title || 'Unknown'}
                                        timestamp={
                                            article.published_at
                                                ? formatRelativeDate(new Date(article.published_at))
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
                                <Text className="text-center text-grey dark:text-grey-dark">
                                    No recent articles available
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* You might also like */}
                    <View className="px-6 pb-8">
                        <View className="mb-2 flex-row items-center justify-between">
                            <Text
                                style={{ letterSpacing: -0.36 }}
                                className="font-geist-bold text-lg text-black dark:text-black-dark">
                                You might also like
                            </Text>
                            <Pressable
                                onPress={handleSeeAllSimilar}
                                className="h-9 w-9 items-center justify-center rounded-full bg-mid-grey active:opacity-60 dark:bg-mid-grey-dark">
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
                                    <View key={index.toString()} className="flex-row gap-3 py-3">
                                        <ShimmerView width={56} height={56} borderRadius={8} />
                                        <View className="flex-1 gap-2">
                                            <ShimmerView width="75%" height={16} borderRadius={4} />
                                            <ShimmerView
                                                width="100%"
                                                height={12}
                                                borderRadius={4}
                                            />
                                        </View>
                                    </View>
                                ))}
                            </View>
                        ) : similarFeeds.length > 0 ? (
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
                        ) : null}
                    </View>
                </ScrollView>
            </SafeAreaView>

            {/* Folder Picker Bottom Sheet - Shared for main feed and similar feeds */}
            <FolderPicker ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
        </>
    );
}
