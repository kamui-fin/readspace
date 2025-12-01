import { FolderPickerBottomSheet } from '@components/bottom-sheets/folder-picker';
import { FolderPickerModal, type FolderPickerModalRef } from '@/components/modals/folder-picker';
import { FeedPreviewBanner } from '@components/screens/discover/ui/feed-preview.banner';
import { ArticleCardSkeletonList } from '@components/screens/following/ui/article-card.skeleton';
import { Button } from '@components/ui/button';
import { Card } from '@components/ui/card';
import { InfiniteScrollList } from '@components/ui/infinite-scroll-list';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { Monicon } from '@monicon/native';
import { ApiClient, type Article, formatRelativeDate, useCreateFeed } from '@readspace/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSegments } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const isIOS = Platform.OS === 'ios';

interface FeedArticlesScreenProps {
  feedId: string;
}

export function FeedArticlesScreen({ feedId }: FeedArticlesScreenProps) {
  const router = useRouter();
  const segments = useSegments();
  const listRef = useRef<any>(null);
  const folderPickerRef = useRef<FolderPickerModalRef>(null);
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const createFeed = useCreateFeed();

  // Fetch feed details to get the title
  const { data: feedData } = useQuery({
    queryKey: ['feed', feedId],
    queryFn: () => ApiClient.rss.getFeed(feedId),
    enabled: !!feedId,
  });

  // Determine if we should show preview mode (feed is not subscribed)
  const shouldShowPreviewBanner = !!(feedData && feedData.is_subscribed === false);

  // Fetch all articles for the feed
  const {
    data: articlesData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['feed-articles-full', feedId],
    queryFn: async () => {
      const response = await ApiClient.rss.getArticles({
        feed_ids: [feedId],
        limit: 50, // Get more articles for the full list
      });
      return response;
    },
    enabled: !!feedId,
  });

  const articles = articlesData?.items || [];
  const feedTitle = feedData?.title || 'Feed';

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

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

  const renderArticle = useCallback(
    (article: Article, index: number) => {
      if (!article) {
        return <View />;
      }
      return (
        <View>
          <Card
            variant="article"
            imageUrl={article.image_url || undefined}
            title={article.title}
            description={article.description || undefined}
            timestamp={
              article.published_at
                ? formatRelativeDate(new Date(article.published_at))
                : 'Unknown date'
            }
            faviconUrl={feedData?.image_url || undefined}
            feedName={feedData?.title || undefined}
            onPress={() => handleArticlePress(article.id)}
            showTopDivider={index > 0}
            showBottomDivider={false}
            className="px-4"
          />
        </View>
      );
    },
    [handleArticlePress, feedData]
  );

  const handleFollowFromPreview = useCallback(() => {
    folderPickerRef.current?.present();
  }, []);

  const handleFolderSelect = useCallback(
    (folderId: string | null) => {
      if (!feedData?.url) {
        toast.error('Feed URL is missing');
        return;
      }

      createFeed.mutate(
        {
          url: feedData.url,
          folder_id: folderId || undefined,
          silent: false,
        },
        {
          onSuccess: () => {
            toast.success(`Following ${feedData.title}`);
          },
          onError: (error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Failed to follow feed';
            toast.error(errorMessage);
          },
        }
      );
    },
    [feedData, createFeed]
  );

  const contentPaddingTop = 16;
  const contentPaddingBottom = BOTTOM_TABBAR_BASE_HEIGHT + 16;

  if (isLoading) {
    return (
      <View className="flex-1 bg-white dark:bg-white-dark" style={{ paddingTop: insets.top }}>
        <View className="px-4 pb-2">
          <View className="flex-row items-center">
            <Button variant="icon" size="small" fullWidth={false} onPress={handleBack}>
              <Monicon
                name="solar:arrow-left-linear"
                size={18}
                strokeWidth={2.4}
                color={colors.grey}
              />
            </Button>
            <View className="absolute left-0 right-0 items-center">
              <Text
                size="base"
                fontFamily="geist-medium"
                className="text-black dark:text-black-dark"
                numberOfLines={1}
                ellipsizeMode="tail">
                {feedTitle}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
        </View>
        <View className="px-6">
          <ArticleCardSkeletonList count={5} />
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 bg-white dark:bg-white-dark" style={{ paddingTop: insets.top }}>
        <View className="px-4 pb-2">
          <View className="flex-row items-center">
            <Button variant="icon" size="small" fullWidth={false} onPress={handleBack}>
              <Monicon
                name="solar:arrow-left-linear"
                size={18}
                strokeWidth={2.4}
                color={colors.grey}
              />
            </Button>
            <View className="absolute left-0 right-0 items-center">
              <Text
                size="base"
                fontFamily="geist-medium"
                className="text-black dark:text-black-dark"
                numberOfLines={1}
                ellipsizeMode="tail">
                Articles from {feedTitle}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Text
            size="base"
            fontFamily="geist"
            className="mb-4 text-center text-grey dark:text-grey-dark">
            Failed to load articles
          </Text>
          <Button variant="primary" size="medium" fullWidth={false} onPress={handleBack}>
            Go Back
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-white-dark" style={{ paddingTop: insets.top }}>
      <View className="px-4 pb-2">
        <View className="flex-row items-center">
          <Button variant="icon" size="small" fullWidth={false} onPress={handleBack}>
            <Monicon
              name="solar:arrow-left-linear"
              size={18}
              strokeWidth={2.4}
              color={colors.grey}
            />
          </Button>
          <View className="absolute left-0 right-0 items-center">
            <Text size="base" fontFamily="geist-medium" className="text-black dark:text-black-dark">
              {feedTitle}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      {articles.length > 0 ? (
        <InfiniteScrollList
          ref={listRef}
          data={articles}
          renderItem={renderArticle}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingTop: contentPaddingTop,
            paddingBottom: shouldShowPreviewBanner
              ? contentPaddingBottom + 80
              : contentPaddingBottom,
          }}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.5}
          estimatedItemSize={200}
        />
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          <Monicon name="solar:inbox-line-linear" size={64} color={colors.grey5} />
          <Text
            size="lg"
            fontFamily="geist-semibold"
            className="mt-4 text-center tracking-heading text-black dark:text-black-dark">
            No articles yet
          </Text>
          <Text
            size="base"
            fontFamily="geist"
            className="mt-2 text-center text-grey dark:text-grey-dark">
            This feed doesn't have any articles yet. Check back later!
          </Text>
        </View>
      )}

      {/* Preview Mode Banner - Sticky at bottom above tab bar */}
      {shouldShowPreviewBanner && feedData && feedData.title && (
        <View
          className="absolute bottom-0 left-0 right-0"
          style={{
            bottom: BOTTOM_TABBAR_BASE_HEIGHT + 0.8 * insets.bottom,
            zIndex: 100,
          }}>
          <View className="items-center pb-2">
            <FeedPreviewBanner feedTitle={feedData.title} onFollow={handleFollowFromPreview} />
          </View>
        </View>
      )}

      {/* Folder picker modal/bottom sheet */}
      {isIOS ? (
        <FolderPickerModal ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
      ) : (
        <FolderPickerBottomSheet ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
      )}
    </View>
  );
}
