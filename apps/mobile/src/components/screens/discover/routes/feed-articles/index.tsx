import ArrowLeftLinearIcon from '@components/icons/solar/arrow-left-linear';
import InboxLineLinearIcon from '@components/icons/solar/inbox-line-linear';
import { ArticleCardSkeletonList } from '@components/screens/following/ui/article-card.skeleton';
import { Button } from '@components/ui/button';
import { Card } from '@components/ui/card';
import { InfiniteScrollList } from '@components/ui/infinite-scroll-list';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { ApiClient, type Article, formatRelativeDate } from '@readspace/shared';
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
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  // Fetch feed details to get the title
  const { data: feedData } = useQuery({
    queryKey: ['feed', feedId],
    queryFn: () => ApiClient.getFeed(feedId),
    enabled: !!feedId,
  });

  // Fetch all articles for the feed
  const {
    data: articlesData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['feed-articles-full', feedId],
    queryFn: async () => {
      const response = await ApiClient.getArticles({
        feed_id: feedId,
        limit: 50,
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
      const currentPath = segments.join('/');
      const articlePath = `articles/${articleId}`;
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
            imageUrl={article.image_url ?? undefined}
            title={article.title ?? ''}
            description={article.description ?? undefined}
            timestamp={
              article.published_at
                ? formatRelativeDate(new Date(article.published_at))
                : 'Unknown date'
            }
            onPress={() => handleArticlePress(article.id)}
            showTopDivider={index > 0}
            showBottomDivider={false}
            className="px-4"
          />
        </View>
      );
    },
    [handleArticlePress]
  );

  const headerSection = (
    <View style={{ paddingTop: insets.top }}>
      <View className="px-4 py-3">
        <View className="flex-row items-center">
          <Button variant="icon" size="small" fullWidth={false} onPress={handleBack}>
            <ArrowLeftLinearIcon width={18} height={18} strokeWidth={2.4} color={colors.grey} />
          </Button>
          <View className="absolute inset-x-12 items-center justify-center">
            <Text
              size="lg"
              fontFamily="geist-semibold"
              className="text-black tracking-tight"
              numberOfLines={1}
              ellipsizeMode="tail">
              {feedTitle}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-white">
        {headerSection}
        <View className="px-6">
          <ArticleCardSkeletonList count={5} />
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 bg-white">
        {headerSection}
        <View className="flex-1 items-center justify-center px-6">
          <Text
            size="base"
            fontFamily="geist"
            className="mb-4 text-center text-grey">
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
    <View className="flex-1 bg-white">
      {headerSection}

      {articles.length > 0 ? (
        <InfiniteScrollList
          ref={listRef}
          data={articles}
          renderItem={renderArticle}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: BOTTOM_TABBAR_BASE_HEIGHT + 16,
          }}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.5}
          estimatedItemSize={200}
        />
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          <InboxLineLinearIcon width={64} height={64} color={colors.grey5} />
          <Text
            size="lg"
            fontFamily="geist-semibold"
            className="mt-4 text-center tracking-heading text-black">
            No articles yet
          </Text>
          <Text
            size="base"
            fontFamily="geist"
            className="mt-2 text-center text-grey">
            This feed doesn't have any articles yet. Check back later!
          </Text>
        </View>
      )}
    </View>
  );
}
