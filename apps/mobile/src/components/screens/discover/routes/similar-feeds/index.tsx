import {
  FolderPickerBottomSheet,
  type FolderPickerBottomSheetRef,
} from '@components/bottom-sheets/folder-picker';
import ArrowLeftLinearIcon from '@components/icons/solar/arrow-left-linear';
import DocumentTextLinearIcon from '@components/icons/solar/document-text-linear';
import { FeedListItem } from '@components/screens/discover/ui/feed-list-item.card';
import { Button } from '@components/ui/button';
import { InfiniteScrollList } from '@components/ui/infinite-scroll-list';
import { Skeleton } from '@components/ui/skeleton';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { FEEDS_INDEX_NAME, meilisearchClient } from '@lib/meilisearch-client';
import { ApiClient, useCreateFeed } from '@readspace/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SIMILAR_PAGE_SIZE = 20;

interface SimilarFeedsScreenProps {
  feedId: string;
}

type SimilarFeedItem = {
  id: string;
  url: string;
  title: string;
  link: string | null;
  image_url: string | undefined;
  language: string;
  description: string;
  is_subscribed: boolean;
  is_preview: boolean;
};

export function SimilarFeedsScreen({ feedId }: SimilarFeedsScreenProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const folderPickerRef = useRef<FolderPickerBottomSheetRef>(null);
  const [pendingFeedUrl, setPendingFeedUrl] = useState<string | null>(null);

  const createFeed = useCreateFeed();
  const router = useRouter();

  // Fetch the feed details to get the title
  const { data: feedData } = useQuery({
    queryKey: ['feed', feedId],
    queryFn: () => ApiClient.getFeed(feedId),
    enabled: !!feedId,
  });

  // Fetch similar feeds with infinite pagination (20 per page)
  const {
    data: similarInfiniteData,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    error,
  } = useInfiniteQuery({
    queryKey: ['similar-feeds-full', feedId],
    queryFn: async ({ pageParam = 0 }) => {
      const index = meilisearchClient.index(FEEDS_INDEX_NAME);
      const results = await index.searchSimilarDocuments({
        id: feedId,
        limit: SIMILAR_PAGE_SIZE,
        offset: pageParam,
        embedder: 'default',
        showRankingScore: true,
      });
      return { hits: results.hits, offset: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (lastPage.hits.length < SIMILAR_PAGE_SIZE) return undefined;
      return lastPage.offset + SIMILAR_PAGE_SIZE;
    },
    enabled: !!feedId,
  });

  const similarFeeds: SimilarFeedItem[] = (
    similarInfiniteData?.pages.flatMap((p) => p.hits) || []
  ).map((hit: any) => ({
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

  const _feedTitle = feedData?.title || 'this feed';

  const headerSection = (
    <View style={{ paddingTop: insets.top }}>
      <View className="px-4 py-3">
        <View className="flex-row items-center">
          <Button variant="icon" size="small" fullWidth={false} onPress={() => router.back()}>
            <ArrowLeftLinearIcon width={18} height={18} strokeWidth={2.4} color={colors.grey} />
          </Button>
          <View className="absolute left-0 right-0 items-center">
            <Text
              size="lg"
              fontFamily="geist-semibold"
              className="tracking-tight text-black"
              numberOfLines={1}
              ellipsizeMode="tail">
              Similar feeds
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>
    </View>
  );

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
          folder_id: folderId || '',
        },
        {
          onSuccess: () => {
            toast.success('Following feed!');
            setPendingFeedUrl(null);
          },
          onError: (error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Failed to follow feed';
            toast.error(errorMessage);
            setPendingFeedUrl(null);
          },
        }
      );
    },
    [pendingFeedUrl, createFeed]
  );

  const renderItem = useCallback(
    (item: SimilarFeedItem) => (
      <View className="px-6">
        <FeedListItem
          feedId={item.id}
          title={item.title || 'Untitled Feed'}
          description={item.description || ''}
          iconUrl={item.image_url || undefined}
          isFollowing={item.is_subscribed || false}
          isPreview={item.is_preview}
          feedUrl={item.url}
          onFollowRequest={handleFeedFollowRequest}
        />
      </View>
    ),
    [handleFeedFollowRequest]
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View className="gap-4 px-6 pt-4">
        {Array.from({ length: 3 }, (_, i) => `similar-footer-skeleton-${i}`).map((key) => (
          <View key={key} className="flex-row gap-3">
            <Skeleton variant="circle" width={48} height={48} />
            <View className="flex-1 gap-2">
              <Skeleton variant="text" width="70%" height={20} />
              <Skeleton variant="text" width="100%" height={16} />
              <Skeleton variant="text" width="80%" height={16} />
            </View>
          </View>
        ))}
      </View>
    );
  }, [isFetchingNextPage]);

  const renderEmpty = useCallback(
    () => (
      <View className="flex-1 items-center justify-center px-6">
        <DocumentTextLinearIcon width={64} height={64} color={colors.grey5} />
        <Text
          size="lg"
          fontFamily="geist-semibold"
          className="tracking-heading mt-4 text-center text-black">
          No similar feeds found
        </Text>
        <Text size="base" fontFamily="geist" className="text-grey mt-2 text-center">
          This feed might be unique, or similar feeds may not have embeddings yet.
        </Text>
      </View>
    ),
    [colors.grey5]
  );

  if (isLoading) {
    return (
      <View className="bg-background flex-1">
        {headerSection}
        <View className="gap-4 px-6 pt-2">
          {Array.from({ length: 8 }, (_, i) => `feed-skeleton-${i}`).map((key) => (
            <View key={key} className="flex-row gap-3">
              <Skeleton variant="circle" width={48} height={48} />
              <View className="flex-1 gap-2">
                <Skeleton variant="text" width="70%" height={20} />
                <Skeleton variant="text" width="100%" height={16} />
                <Skeleton variant="text" width="80%" height={16} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className="bg-background flex-1">
        {headerSection}
        <View className="flex-1 items-center justify-center px-6">
          <Text size="base" fontFamily="geist" className="text-grey mb-4 text-center">
            Failed to load similar feeds
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <View className="bg-background flex-1">
        {headerSection}
        <InfiniteScrollList
          data={similarFeeds}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          estimatedItemSize={72}
          hasMore={hasNextPage ?? false}
          isLoading={isFetchingNextPage}
          onEndReached={fetchNextPage}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: BOTTOM_TABBAR_BASE_HEIGHT + 16,
          }}
        />
      </View>

      <FolderPickerBottomSheet ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
    </>
  );
}
