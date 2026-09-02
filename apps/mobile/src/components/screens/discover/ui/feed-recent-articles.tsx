import { Card } from '@components/ui/card';
import { EmptyState } from '@components/ui/empty-state';
import { SectionHeader } from '@components/ui/section-header';
import { Skeleton } from '@components/ui/skeleton';
import { resolveSupabaseImageUrl } from '@lib/utils/network';
import { Feed, FeedDiscoveryResult, formatRelativeDate } from '@readspace/shared';
import { DocumentTextIcon } from '@solar-icons/react-native/linear';
import { Dimensions, FlatList, View } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.7;
const CARD_SPACING = 16;

interface FeedRecentArticlesProps {
  articles: any[];
  isLoading: boolean;
  feed: FeedDiscoveryResult | Feed;
  onShowMore: () => void;
  onArticlePress: (id: string) => void;
  colors: unknown;
  greyColor: string;
}

export function FeedRecentArticles({
  articles,
  isLoading,
  feed,
  onShowMore,
  onArticlePress,
  colors: _colors,
  greyColor,
}: FeedRecentArticlesProps) {
  return (
    <View className="mb-8 mt-6">
      <SectionHeader
        title="Recent articles"
        onSeeAll={articles.length > 0 ? onShowMore : undefined}
        className="mb-3 px-6"
        iconColor={greyColor}
      />

      {isLoading ? (
        <View className="px-6">
          <View className="flex-row gap-4">
            {Array.from({ length: 2 }, (_, i) => `article-load-skeleton-${i}`).map((key) => (
              <Skeleton
                key={key}
                variant="rectangle"
                width={CARD_WIDTH}
                height={200}
                className="rounded-2xl"
              />
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
              faviconUrl={resolveSupabaseImageUrl(feed.image_url) || undefined}
              feedName={feed.title || undefined}
              onPress={() => onArticlePress(article.id)}
              className="mr-4"
              style={{ width: CARD_WIDTH }}
            />
          )}
          keyExtractor={(item) => item.id}
        />
      ) : (
        <EmptyState
          icon={DocumentTextIcon}
          message="No recent articles available"
          className="py-8"
        />
      )}
    </View>
  );
}
