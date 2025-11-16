import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { Text } from '@components/ui/text';
import { useRouter, useSegments } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Monicon } from '@monicon/native';

import {
  ApiClient,
  formatRelativeDate,
  useCreateFeed,
  useDeleteFeed,
  useFeed,
  type FeedDiscoveryResult,
  type SimilarFeedsResponse,
} from '@readspace/shared';
import { Card } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { FeedListItem } from '@components/screens/discover/ui/feed-list-item.card';
import { Skeleton } from '@components/ui/skeleton';
import {
  FolderPickerModal,
  type FolderPickerModalRef,
} from '@/components/modals/folder-picker.modal';
import { FolderPickerBottomSheet } from '@/components/bottom-sheets/folder-picker';
import { COLORS } from '@lib/constants/colors';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { toast } from '@components/ui/toast';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { Chip } from '@/components/ui/chip';

const isIOS = Platform.OS === 'ios';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.7;
const CARD_SPACING = 16;

interface FeedPreviewScreenProps {
  feedId: string;
}

export function FeedPreviewScreen({ feedId }: FeedPreviewScreenProps) {
  const router = useRouter();
  const segments = useSegments();
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const folderPickerRef = useRef<FolderPickerModalRef>(null);
  const [pendingSimilarFeedUrl, setPendingSimilarFeedUrl] = useState<string | null>(null);
  const [isPreviewRefreshing, setIsPreviewRefreshing] = useState(false);
  const [previewFeedData, setPreviewFeedData] = useState<FeedDiscoveryResult | null>(null);

  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const greyColor = isDark ? COLORS.dark.grey : COLORS.light.grey;
  const insets = useSafeAreaInsets();

  // Local state to track subscription status for immediate UI updates
  const [localIsSubscribed, setLocalIsSubscribed] = useState<boolean | null>(null);

  // Ref to track if preview refresh has already been triggered
  const hasRefreshedPreview = useRef(false);
  // State to track if we need to wait for preview refresh before showing articles
  const [shouldWaitForPreview, setShouldWaitForPreview] = useState(false);

  const queryClient = useQueryClient();

  // Fetch feed data - disable if we're doing preview refresh
  const { data: fetchedFeedData, isLoading: isFeedLoading } = useFeed(feedId || '', {
    enabled: !!feedId && !isPreviewRefreshing,
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

  const createFeed = useCreateFeed();
  const deleteFeed = useDeleteFeed();

  // Fetch preview articles for the feed
  // Don't fetch articles until preview refresh is done (if in preview mode)
  const {
    data: articlesData,
    isLoading: isArticlesLoading,
    refetch: refetchArticles,
  } = useQuery({
    queryKey: ['feed-articles', feedId],
    queryFn: async () => {
      const response = await ApiClient.rss.getArticles({
        feed_ids: [feedId],
        limit: 5,
      });
      return response;
    },
    enabled: !!feedId && !shouldWaitForPreview,
  });

  // Fetch similar feeds (top 4 for preview)
  const { data: similarData, isLoading: isSimilarLoading } = useQuery<SimilarFeedsResponse>({
    queryKey: ['similar-feeds-preview', feedId, 4],
    queryFn: () => ApiClient.rss.getSimilarFeeds(feedId, { limit: 4 }),
    enabled: !!feedId,
  });

  const articles = articlesData?.items || [];
  const similarFeeds = similarData?.similar_feeds || [];
  // Use local state if available, otherwise fall back to feed data
  const isFollowing = localIsSubscribed !== null ? localIsSubscribed : feed?.is_subscribed || false;

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

  // Check if feed is dead (no articles published in last 6 months)
  const isFeedDead =
    articles.length > 0 && articles[0].published_at
      ? Date.now() - new Date(articles[0].published_at).getTime() > 6 * 30 * 24 * 60 * 60 * 1000
      : false;

  // Preview mode: refresh feed on mount to get latest articles
  useEffect(() => {
    if (shouldShowPreviewBanner && feedId && !hasRefreshedPreview.current) {
      hasRefreshedPreview.current = true;
      setShouldWaitForPreview(true);
      setIsPreviewRefreshing(true);

      // Call API directly with preview=true parameter
      ApiClient.rss
        .refreshFeed(feedId, true, true)
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
  }, [shouldShowPreviewBanner, feedId, refetchArticles]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

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
          onSuccess: () => {
            toast.success(pendingSimilarFeedUrl ? 'Following feed!' : `Following ${feed?.title}`);
            setPendingSimilarFeedUrl(null);

            // If we just followed the current feed (not a similar feed)
            if (!pendingSimilarFeedUrl && feed?.id) {
              // Invalidate the feed cache to ensure the Following screen gets updated data
              queryClient.invalidateQueries({
                queryKey: ['feeds', feed.id],
              });
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
      const articleRoute = `/(protected)/articles/${articleId}`;
      // Prevent duplicate navigation - check if already on this route
      const currentPath = segments.join('/');
      const articlePath = `articles/${articleId}`;
      // Only navigate if not already on this article route
      if (!currentPath.includes(articlePath)) {
        router.push(articleRoute);
      }
    },
    [router, segments]
  );

  const toggleDescription = useCallback(() => {
    setIsDescriptionExpanded((prev) => !prev);
  }, []);

  const handleShowMoreArticles = useCallback(() => {
    // Navigate to feed articles view
    router.push(`/(protected)/(tabs)/discover/feed/${feedId}/articles`);
  }, [router, feedId]);

  const handleShowMoreSimilarFeeds = useCallback(() => {
    // Navigate to similar feeds full list
    router.push(`/(protected)/(tabs)/discover/feed/${feedId}/similar`);
  }, [router, feedId]);

  // Only show full skeleton during initial feed loading, not during preview refresh
  if (isFeedLoading && !isPreviewRefreshing) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-white-dark" edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} className="px-6 pt-2">
          <View className="mb-6" />
          <View className="mb-4">
            <Skeleton variant="circle" width={96} height={96} />
          </View>
          <Skeleton variant="text" width="60%" height={28} className="mb-2" />
          <Skeleton variant="text" width="100%" height={20} className="mb-2" />
          <Skeleton variant="text" width="80%" height={20} className="mb-4" />
          <Skeleton variant="rectangle" width="100%" height={48} className="mb-8" />

          <Skeleton variant="text" width="40%" height={24} className="mb-4" />
          <View className="gap-4 mb-8">
            {Array.from({ length: 3 }, (_, i) => `article-skeleton-${i}`).map((key) => (
              <View key={key} className="flex-row gap-3">
                <Skeleton variant="rectangle" width={280} height={200} />
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!feed) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-white-dark" edges={['top']}>
        <View className="flex-1 items-center justify-center px-6">
          <Text
            size="base"
            fontFamily="geist"
            className="text-center text-grey dark:text-grey-dark">
            Feed not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView className="flex-1 bg-white dark:bg-white-dark" edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: BOTTOM_TABBAR_BASE_HEIGHT + 16,
          }}>
          {/* Header */}
          <View className="px-4 pb-4 pt-2">
            <View className="mb-6 flex-row items-center">
              <Button variant="icon" size="small" fullWidth={false} onPress={handleBack}>
                <Monicon
                  name="solar:arrow-left-linear"
                  size={18}
                  strokeWidth={2.4}
                  color={greyColor}
                />
              </Button>
            </View>

            {/* Feed Icon */}
            <View className="relative mb-4">
              <View
                className="h-24 w-24 items-center justify-center overflow-hidden rounded-3xl"
                style={{
                  backgroundColor: colors.white,
                }}>
                {feed.image_url ? (
                  <Image
                    source={{ uri: feed.image_url }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                ) : (
                  <Text
                    size="lg"
                    fontFamily="geist-bold"
                    style={{ color: colors.grey, fontSize: 30 }}>
                    {(feed.title || 'F').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              {isFeedDead && (
                <Chip
                  label="Inactive"
                  variant="filled"
                  size="medium"
                  className="absolute -right-1 -top-1 bg-red"
                  textClassName="text-white"
                />
              )}
            </View>

            {/* Feed Title */}
            <Text
              size="2xl"
              fontFamily="geist-bold"
              style={{ letterSpacing: -0.48 }}
              className="mb-2 text-black dark:text-black-dark">
              {feed.title || 'Untitled Feed'}
            </Text>

            {/* Feed Description */}
            {feed.description && (
              <View className="mb-4">
                {feed.description.length > 80 ? (
                  <>
                    <Text
                      size="base"
                      fontFamily="geist"
                      className="leading-6 text-grey dark:text-grey-dark">
                      {isDescriptionExpanded
                        ? feed.description
                        : `${feed.description.slice(0, 80)}... `}
                      {!isDescriptionExpanded && (
                        <Text
                          size="base"
                          fontFamily="geist-medium"
                          onPress={toggleDescription}
                          className="text-black dark:text-black-dark">
                          more
                        </Text>
                      )}
                    </Text>
                    {isDescriptionExpanded && (
                      <Pressable onPress={toggleDescription}>
                        <Text
                          size="base"
                          fontFamily="geist-medium"
                          className="mt-1 text-black dark:text-black-dark">
                          less
                        </Text>
                      </Pressable>
                    )}
                  </>
                ) : (
                  <Text
                    size="base"
                    fontFamily="geist"
                    className="leading-6 text-grey dark:text-grey-dark">
                    {feed.description}
                  </Text>
                )}
              </View>
            )}

            {/* Feed URL */}
            {(feed.link || feed.url) && (
              <Pressable onPress={handleUrlPress} className="mb-4 flex-row items-center gap-2">
                <Monicon
                  name="solar:link-minimalistic-2-bold"
                  size={20}
                  strokeWidth={2.4}
                  color={colors.primary}
                />
                <Text
                  size="sm"
                  fontFamily="geist"
                  className="flex-1 flex-shrink underline"
                  style={{ color: colors.primary }}
                  numberOfLines={1}>
                  {feed.link || feed.url}
                </Text>
              </Pressable>
            )}

            {/* Feed Tags */}
            {feed.tags && feed.tags.length > 0 && (
              <View className="mb-6 flex-row flex-wrap items-center gap-2">
                {feed.tags.slice(0, 5).map((tag: string | { name: string }, index: number) => {
                  const tagName = typeof tag === 'string' ? tag : (tag as any)?.name || 'Tag';
                  const formattedTag = tagName.replace(/\s+/g, '-');
                  return (
                    <View
                      key={`${tagName}-${index.toString()}`}
                      className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
                      style={{ backgroundColor: colors.grey5 }}>
                      <Text
                        size="sm"
                        fontFamily="geist"
                        style={{ color: colors.grey, fontSize: 12 }}>
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
              loading={createFeed.isPending || deleteFeed.isPending}>
              {createFeed.isPending
                ? 'Following...'
                : deleteFeed.isPending
                  ? 'Unfollowing...'
                  : isFollowing
                    ? 'Unfollow'
                    : 'Follow'}
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
              {articles.length > 0 && (
                <Button
                  variant="icon"
                  size="small"
                  fullWidth={false}
                  onPress={handleShowMoreArticles}>
                  <Monicon
                    name="solar:alt-arrow-right-linear"
                    size={18}
                    strokeWidth={2.4}
                    color={greyColor}
                  />
                </Button>
              )}
            </View>

            {isArticlesLoading || isPreviewRefreshing || shouldWaitForPreview ? (
              <View className="px-6">
                <View className="flex-row gap-4">
                  {Array.from({ length: 2 }, (_, i) => `article-load-skeleton-${i}`).map((key) => (
                    <Skeleton key={key} variant="rectangle" width={CARD_WIDTH} height={200} />
                  ))}
                </View>
              </View>
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
                  <Card
                    variant="image-top"
                    imageUrl={article.image_url || undefined}
                    title={article.title}
                    description={article.description || undefined}
                    timestamp={
                      article.published_at
                        ? formatRelativeDate(new Date(article.published_at))
                        : 'Unknown date'
                    }
                    faviconUrl={feed.image_url || undefined}
                    feedName={feed.title || undefined}
                    onPress={() => handleArticlePress(article.id)}
                    className="mr-4"
                    style={{ width: CARD_WIDTH }}
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
              {similarFeeds.length > 0 && (
                <Button
                  variant="icon"
                  size="small"
                  fullWidth={false}
                  onPress={handleShowMoreSimilarFeeds}>
                  <Monicon
                    name="solar:alt-arrow-right-linear"
                    size={18}
                    strokeWidth={2.4}
                    color={greyColor}
                  />
                </Button>
              )}
            </View>

            {isSimilarLoading ? (
              <View className="gap-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <View key={index.toString()} className="flex-row gap-3 py-3">
                    <View
                      className="h-14 w-14 rounded-lg"
                      style={{ backgroundColor: colors.grey5 }}
                    />
                    <View className="flex-1 gap-2">
                      <View
                        className="h-4 rounded"
                        style={{
                          width: '75%',
                          backgroundColor: colors.grey5,
                        }}
                      />
                      <View
                        className="h-3 rounded"
                        style={{
                          width: '100%',
                          backgroundColor: colors.grey5,
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : similarFeeds.length > 0 ? (
              <View className="gap-2">
                {similarFeeds.map((similarFeed) => (
                  <FeedListItem
                    key={similarFeed.id}
                    feedId={similarFeed.id}
                    title={similarFeed.title || 'Untitled Feed'}
                    description={similarFeed.description || ''}
                    iconUrl={similarFeed.image_url || undefined}
                    isFollowing={similarFeed.is_subscribed || false}
                    isPreview={similarFeed.is_preview}
                    feedUrl={similarFeed.url}
                    onFollowRequest={(url) => handleSimilarFeedFollowRequest(url)}
                  />
                ))}
              </View>
            ) : (
              <Text className="text-center text-grey dark:text-grey-dark">
                No similar feeds found
              </Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Folder Picker Modal/Bottom Sheet - Shared for main feed and similar feeds */}
      {isIOS ? (
        <FolderPickerModal ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
      ) : (
        <FolderPickerBottomSheet ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
      )}
    </>
  );
}
