import { FolderPickerModal, type FolderPickerModalRef } from '@/components/modals/folder-picker';
import { FolderPickerBottomSheet } from '@components/bottom-sheets/folder-picker';
import { FeedInfoHeader } from '@components/screens/discover/ui/feed-info-header';
import { FeedPreviewSkeleton } from '@components/screens/discover/ui/feed-preview-skeleton';
import { FeedRecentArticles } from '@components/screens/discover/ui/feed-recent-articles';
import { FeedSimilarList } from '@components/screens/discover/ui/feed-similar-list';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import {
  ApiClient,
  type FeedDiscoveryResult,
  type SimilarFeedsResponse,
  useCreateFeed,
  useDeleteFeed,
  useFeed,
} from '@readspace/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const isIOS = Platform.OS === 'ios';

interface FeedPreviewScreenProps {
  feedId: string;
}

export function FeedPreviewScreen({ feedId }: FeedPreviewScreenProps) {
  const router = useRouter();
  const segments = useSegments();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
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
    // If we have a returnTo param, navigate there instead of going back
    if (returnTo) {
      router.push(Array.isArray(returnTo) ? returnTo[0] : returnTo);
    } else {
      router.back();
    }
  }, [router, returnTo]);

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
    return <FeedPreviewSkeleton />;
  }

  if (!feed) {
    return (
      <View className="flex-1 bg-white dark:bg-white-dark" style={{ paddingTop: insets.top }}>
        <View className="flex-1 items-center justify-center px-6">
          <Text
            size="base"
            fontFamily="geist"
            className="text-center text-grey dark:text-grey-dark">
            Feed not found
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <View className="flex-1 bg-white dark:bg-white-dark" style={{ paddingTop: insets.top }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: BOTTOM_TABBAR_BASE_HEIGHT + 16,
          }}>
          <FeedInfoHeader
            feed={feed}
            isFollowing={isFollowing}
            isFeedDead={isFeedDead}
            isFollowLoading={createFeed.isPending || deleteFeed.isPending}
            onBack={handleBack}
            onFollow={handleFollowPress}
            colors={colors}
            greyColor={greyColor}
          />

          <FeedRecentArticles
            articles={articles}
            isLoading={isArticlesLoading || isPreviewRefreshing || shouldWaitForPreview}
            feed={feed}
            onShowMore={handleShowMoreArticles}
            onArticlePress={handleArticlePress}
            colors={colors}
            greyColor={greyColor}
          />

          <FeedSimilarList
            similarFeeds={similarFeeds}
            isLoading={isSimilarLoading}
            onShowMore={handleShowMoreSimilarFeeds}
            onFollowRequest={handleSimilarFeedFollowRequest}
            colors={colors}
            greyColor={greyColor}
          />
        </ScrollView>
      </View>

      {/* Folder Picker Modal/Bottom Sheet - Shared for main feed and similar feeds */}
      {isIOS ? (
        <FolderPickerModal ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
      ) : (
        <FolderPickerBottomSheet ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
      )}
    </>
  );
}
