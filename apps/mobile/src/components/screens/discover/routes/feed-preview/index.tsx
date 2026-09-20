import {
  FolderPickerBottomSheet,
  type FolderPickerBottomSheetRef,
} from '@components/bottom-sheets/folder-picker';
import { FeedInfoHeader } from '@components/screens/discover/ui/feed-info-header';
import { FeedPreviewSkeleton } from '@components/screens/discover/ui/feed-preview-skeleton';
import { FeedRecentArticles } from '@components/screens/discover/ui/feed-recent-articles';
import { FeedSimilarList } from '@components/screens/discover/ui/feed-similar-list';
import { NativeScreenHeader } from '@components/ui/native-screen-header';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { USES_NATIVE_HEADER } from '@lib/constants/platform';
import { FEEDS_INDEX_NAME, meilisearchClient } from '@lib/meilisearch-client';
import {
  ApiClient,
  queryKeys,
  RSS_QUERY_KEYS,
  useCreateFeed,
  useDeleteFeed,
  useFeed,
} from '@readspace/shared';
import { discoverLanguageToCode, getDiscoverLanguage } from '@stores/discover-preferences';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FeedPreviewScreenProps {
  feedId: string;
  initialData?: {
    title?: string;
    description?: string;
    image_url?: string;
  };
}

export function FeedPreviewScreen({ feedId, initialData: _initialData }: FeedPreviewScreenProps) {
  const router = useRouter();
  const segments = useSegments();
  const folderPickerRef = useRef<FolderPickerBottomSheetRef>(null);
  const [pendingSimilarFeedUrl, setPendingSimilarFeedUrl] = useState<string | null>(null);

  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const greyColor = isDark ? COLORS.dark.grey : COLORS.light.grey;
  const insets = useSafeAreaInsets();
  // The native navigation bar already clears the status bar on iOS.
  const contentPaddingTop = USES_NATIVE_HEADER ? 0 : insets.top;

  const queryClient = useQueryClient();

  const { data: fetchedFeedData, isLoading: isFeedLoading } = useFeed(feedId || '');

  // Use preview feed data if available, otherwise use fetched data.
  const feed = fetchedFeedData;

  const createFeed = useCreateFeed();
  const deleteFeed = useDeleteFeed();

  // Carry the discover screen's language filter into the "you might also like" list.
  const languageCode = discoverLanguageToCode(getDiscoverLanguage());

  // Fetch preview articles for the feed
  const { data: articlesData, isLoading: isArticlesLoading } = useQuery({
    queryKey: ['feed-articles', feedId],
    queryFn: async () => {
      const response = await ApiClient.getArticles({
        feed_id: feedId,
        limit: 5,
      });
      return response;
    },
    enabled: !!feedId,
  });

  // Fetch similar feeds (top 4 for preview)
  const { data: similarData, isLoading: isSimilarLoading } = useQuery({
    queryKey: ['similar-feeds-preview', feedId, 4, languageCode],
    queryFn: async () => {
      const index = meilisearchClient.index(FEEDS_INDEX_NAME);
      const results = await index.searchSimilarDocuments({
        id: feedId,
        limit: 4,
        embedder: 'default',
        showRankingScore: true,
        filter: languageCode ? `language = "${languageCode}"` : undefined,
      });
      return results;
    },
    enabled: !!feedId,
  });

  const articles = articlesData?.items || [];
  const similarFeeds = (similarData?.hits || []).map((hit: any) => ({
    id: hit.id,
    url: hit.url,
    title: hit.title,
    link: hit.link ?? null,
    image_url: hit.image_url ?? undefined,
    language: hit.language ?? 'en',
    description: hit.description ?? '',
    is_subscribed: false,
    is_preview: true,
  }));
  // Track optimistic and loading states
  const [optimisticFollowing, setOptimisticFollowing] = useState<boolean | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  const actuallyFollowing = feed?.is_subscribed || false;

  // Clear optimistic state when actual state catches up and matches it
  useEffect(() => {
    if (optimisticFollowing !== null && optimisticFollowing === actuallyFollowing) {
      setOptimisticFollowing(null);
    }
  }, [optimisticFollowing, actuallyFollowing]);

  const isFollowing = optimisticFollowing !== null ? optimisticFollowing : actuallyFollowing;

  const handleFollowPress = useCallback(() => {
    if (isFollowing && feed?.id) {
      // Unfollow
      setLocalLoading(true);
      setOptimisticFollowing(false);
      deleteFeed.mutate(
        { feedId: feed.id, silent: false },
        {
          onSuccess: () => {
            toast.success('Unfollowed feed');
            queryClient.invalidateQueries({
              queryKey: [RSS_QUERY_KEYS.FEEDS, 'list'],
            });
            queryClient.invalidateQueries({
              queryKey: [RSS_QUERY_KEYS.ARTICLES],
            });
            queryClient.invalidateQueries({
              queryKey: queryKeys.unreadCounts(),
            });
            if (feed?.id) {
              queryClient.invalidateQueries({
                queryKey: queryKeys.feed(feed.id),
              });
            }
          },
          onError: () => {
            toast.error('Failed to unfollow feed');
            setOptimisticFollowing(null);
          },
          onSettled: () => {
            setLocalLoading(false);
          },
        }
      );
    } else {
      // Show folder picker to follow
      folderPickerRef.current?.present();
    }
  }, [isFollowing, feed, deleteFeed]);

  // The screen is pushed onto whichever stack the reader is already in, so an ordinary pop is
  // always right. It used to be handed a `returnTo` path and *push* that, because reaching it
  // from an article jumped into the Discover tab's own stack and rebuilt it with this screen as
  // the root — no history to pop, and so no back button at all.
  const handleBack = useCallback(() => router.back(), [router]);

  const handleSimilarFeedFollowRequest = useCallback((feedUrl: string) => {
    setPendingSimilarFeedUrl(feedUrl);
    folderPickerRef.current?.present();
  }, []);

  const handleFolderSelect = useCallback(
    async (folderId: string | null) => {
      // Determine which feed to follow: main feed or a similar feed
      const feedUrlToFollow = pendingSimilarFeedUrl || feed?.url;

      if (!feedUrlToFollow) {
        toast.error('Feed URL is missing');
        return;
      }

      const isMainFeed = !pendingSimilarFeedUrl;
      if (isMainFeed) {
        setLocalLoading(true);
      }

      try {
        await createFeed.mutateAsync({
          url: feedUrlToFollow,
          folder_id: folderId || '',
        });

        toast.success(
          pendingSimilarFeedUrl ? 'Following feed!' : `Following ${feed?.title || 'feed'}!`
        );

        if (isMainFeed) {
          setOptimisticFollowing(true);
        }
        setPendingSimilarFeedUrl(null);

        // Invalidate the feeds list, articles, and unread counts cache to ensure the Following screen gets updated data
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS, 'list'],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLES],
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.unreadCounts(),
        });
        if (isMainFeed && feed?.id) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.feed(feed.id),
          });
        }
      } catch (_error: any) {
        setPendingSimilarFeedUrl(null);
        toast.error('Failed to follow feed');
      } finally {
        if (isMainFeed) {
          setLocalLoading(false);
        }
      }
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
    router.push(`/(protected)/feed/${feedId}/articles`);
  }, [router, feedId]);

  const handleShowMoreSimilarFeeds = useCallback(() => {
    // Navigate to similar feeds full list
    router.push(`/(protected)/feed/${feedId}/similar`);
  }, [router, feedId]);

  // Check if feed is dead (no articles published in last 6 months)
  const isFeedDead =
    articles.length > 0 && articles[0].published_at
      ? Date.now() - new Date(articles[0].published_at).getTime() > 6 * 30 * 24 * 60 * 60 * 1000
      : false;

  // Only show full skeleton when we have no data at all to display — if we already
  // have initialData (previewFeedFallback), show that immediately instead of a skeleton
  if (isFeedLoading) {
    // The header mounts with the skeleton so the navigation bar doesn't pop in once data lands.
    return (
      <>
        <NativeScreenHeader />
        <FeedPreviewSkeleton />
      </>
    );
  }

  if (!feed) {
    return (
      <View className="bg-background flex-1" style={{ paddingTop: contentPaddingTop }}>
        <NativeScreenHeader />
        <View className="flex-1 items-center justify-center px-6">
          <Text size="base" fontFamily="geist" className="text-grey text-center">
            Feed not found
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <View className="bg-background flex-1" style={{ paddingTop: contentPaddingTop }}>
        {/* No title: the feed's own identity block sits right below the bar, so the bar is just
            the back button. */}
        <NativeScreenHeader />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: 16,
          }}>
          <FeedInfoHeader
            feed={feed}
            isFollowing={isFollowing}
            isFeedDead={isFeedDead}
            isFollowLoading={localLoading}
            onBack={handleBack}
            onFollow={handleFollowPress}
            colors={colors}
            greyColor={greyColor}
          />

          <FeedRecentArticles
            articles={articles}
            isLoading={isArticlesLoading}
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

      <FolderPickerBottomSheet ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
    </>
  );
}
