import {
  FolderPickerBottomSheet,
  type FolderPickerBottomSheetRef,
} from '@components/bottom-sheets/folder-picker';
import { FeedInfoHeader } from '@components/screens/discover/ui/feed-info-header';
import { FeedPreviewSkeleton } from '@components/screens/discover/ui/feed-preview-skeleton';
import { FeedRecentArticles } from '@components/screens/discover/ui/feed-recent-articles';
import { FeedSimilarList } from '@components/screens/discover/ui/feed-similar-list';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { FEEDS_INDEX_NAME, meilisearchClient } from '@lib/meilisearch-client';
import {
  ApiClient,
  type FeedDiscoveryResult,
  useCreateFeed,
  useDeleteFeed,
  useFeed,
} from '@readspace/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FeedPreviewScreenProps {
  feedId: string;
  initialData?: {
    title?: string;
    description?: string;
    image_url?: string;
  };
}

export function FeedPreviewScreen({ feedId, initialData }: FeedPreviewScreenProps) {
  const router = useRouter();
  const segments = useSegments();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const folderPickerRef = useRef<FolderPickerBottomSheetRef>(null);
  const [pendingSimilarFeedUrl, setPendingSimilarFeedUrl] = useState<string | null>(null);

  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const greyColor = isDark ? COLORS.dark.grey : COLORS.light.grey;
  const insets = useSafeAreaInsets();

  const queryClient = useQueryClient();

  const { data: fetchedFeedData, isLoading: isFeedLoading } = useFeed(feedId || '');

  // Use preview feed data if available, otherwise use fetched data.
  const feed = fetchedFeedData;

  console.log(feed);

  console.log('rendering');

  const createFeed = useCreateFeed();
  const deleteFeed = useDeleteFeed();

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
    queryKey: ['similar-feeds-preview', feedId, 4],
    queryFn: async () => {
      const index = meilisearchClient.index(FEEDS_INDEX_NAME);
      const results = await index.searchSimilarDocuments({
        id: feedId,
        limit: 4,
        embedder: 'default',
        showRankingScore: true,
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
  const isFollowing = feed?.is_subscribed || false;

  const handleFollowPress = useCallback(() => {
    if (isFollowing && feed?.id) {
      // Optimistically update
      queryClient.setQueryData(['feed', feed.id], (old: any) =>
        old ? { ...old, is_subscribed: false } : old
      );

      // Unfollow
      deleteFeed.mutate(
        { feedId: feed.id, silent: false },
        {
          onSuccess: () => {
            toast.success('Unfollowed feed');
          },
          onError: () => {
            toast.error('Failed to unfollow feed');
            // Revert on error
            queryClient.setQueryData(['feed', feed.id], (old: any) =>
              old ? { ...old, is_subscribed: true } : old
            );
          },
        }
      );
    } else {
      // Show folder picker to follow
      folderPickerRef.current?.present();
    }
  }, [isFollowing, feed, deleteFeed, queryClient]);

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
    async (folderId: string | null) => {
      // Determine which feed to follow: main feed or a similar feed
      const feedUrlToFollow = pendingSimilarFeedUrl || feed?.url;

      if (!feedUrlToFollow) {
        toast.error('Feed URL is missing');
        return;
      }

      // Optimistic update if following current feed
      if (!pendingSimilarFeedUrl && feed?.id) {
        queryClient.setQueryData(['feed', feed.id], (old: any) =>
          old ? { ...old, is_subscribed: true } : old
        );
      }

      try {
        await toast.promise(
          createFeed.mutateAsync({
            url: feedUrlToFollow,
            folder_id: folderId || '',
          }),
          {
            loading: 'Following feed...',
            success: pendingSimilarFeedUrl ? 'Following feed!' : `Following ${feed?.title || 'feed'}!`,
            error: 'Failed to follow feed',
          }
        );

        setPendingSimilarFeedUrl(null);

        // If we just followed the current feed (not a similar feed)
        if (!pendingSimilarFeedUrl && feed?.id) {
          // Invalidate the feed cache to ensure the Following screen gets updated data
          queryClient.invalidateQueries({
            queryKey: ['feeds', feed.id],
          });
        }
      } catch (error: any) {
        setPendingSimilarFeedUrl(null);

        // Revert optimistic update on error
        if (!pendingSimilarFeedUrl && feed?.id) {
          queryClient.setQueryData(['feed', feed.id], (old: any) =>
            old ? { ...old, is_subscribed: false } : old
          );
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
    router.push(`/(protected)/(tabs)/discover/feed/${feedId}/articles`);
  }, [router, feedId]);

  const handleShowMoreSimilarFeeds = useCallback(() => {
    // Navigate to similar feeds full list
    router.push(`/(protected)/(tabs)/discover/feed/${feedId}/similar`);
  }, [router, feedId]);

  // Check if feed is dead (no articles published in last 6 months)
  const isFeedDead =
    articles.length > 0 && articles[0].published_at
      ? Date.now() - new Date(articles[0].published_at).getTime() > 6 * 30 * 24 * 60 * 60 * 1000
      : false;

  // Only show full skeleton when we have no data at all to display — if we already
  // have initialData (previewFeedFallback), show that immediately instead of a skeleton
  if (isFeedLoading) {
    return <FeedPreviewSkeleton />;
  }

  if (!feed) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="flex-1 items-center justify-center px-6">
          <Text
            size="base"
            fontFamily="geist"
            className="text-grey text-center">
            Feed not found
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
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
