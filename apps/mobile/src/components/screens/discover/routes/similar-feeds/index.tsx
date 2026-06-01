import {
  FolderPickerBottomSheet,
  type FolderPickerBottomSheetRef,
} from '@components/bottom-sheets/folder-picker';
import ArrowLeftLinearIcon from '@components/icons/solar/arrow-left-linear';
import DocumentTextLinearIcon from '@components/icons/solar/document-text-linear';
import { FeedListItem } from '@components/screens/discover/ui/feed-list-item.card';
import { Button } from '@components/ui/button';
import { Skeleton } from '@components/ui/skeleton';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { FEEDS_INDEX_NAME, meilisearchClient } from '@lib/meilisearch-client';
import { ApiClient, useCreateFeed } from '@readspace/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SimilarFeedsScreenProps {
  feedId: string;
}

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

  // Fetch similar feeds data (full list - 20 items)
  const {
    data: similarData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['similar-feeds-full', feedId, 20],
    queryFn: async () => {
      const index = meilisearchClient.index(FEEDS_INDEX_NAME);
      const results = await index.searchSimilarDocuments({
        id: feedId,
        limit: 20,
        embedder: 'default',
        showRankingScore: true,
      });
      return results;
    },
    enabled: !!feedId,
  });

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

  if (isLoading) {
    return (
      <View className="bg-background flex-1">
        {headerSection}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: BOTTOM_TABBAR_BASE_HEIGHT + 16,
            paddingTop: 8,
          }}>
          <View className="gap-4 px-6">
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
        </ScrollView>
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
        {similarFeeds.length > 0 ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: BOTTOM_TABBAR_BASE_HEIGHT + 16,
            }}
            removeClippedSubviews={false}>
            <View className="gap-5 px-6">
              {similarFeeds.map((similarFeed: any) => (
                <FeedListItem
                  key={similarFeed.id}
                  feedId={similarFeed.id}
                  title={similarFeed.title || 'Untitled Feed'}
                  description={similarFeed.description || ''}
                  iconUrl={similarFeed.image_url || undefined}
                  isFollowing={similarFeed.is_subscribed || false}
                  isPreview={similarFeed.is_preview}
                  feedUrl={similarFeed.url}
                  onFollowRequest={handleFeedFollowRequest}
                />
              ))}
            </View>
          </ScrollView>
        ) : (
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
        )}
      </View>

      <FolderPickerBottomSheet ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
    </>
  );
}
