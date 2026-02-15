import { Button } from '@components/ui/button';
import { EmptyState } from '@components/ui/empty-state';
import { Card } from '@components/ui/card';
import { Skeleton } from '@components/ui/skeleton';
import { Text } from '@components/ui/text';
import { COLORS } from '@lib/constants/colors';
import { Monicon } from '@monicon/native';
import { Feed, FeedDiscoveryResult, formatRelativeDate } from '@readspace/shared';
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
  colors: typeof COLORS.light | typeof COLORS.dark;
  greyColor: string;
}

export function FeedRecentArticles({
  articles,
  isLoading,
  feed,
  onShowMore,
  onArticlePress,
  colors,
  greyColor,
}: FeedRecentArticlesProps) {
  return (
    <View className="mb-8 mt-8">
      <View className="mb-5 flex-row items-center justify-between px-6">
        <Text
          size="lg"
          fontFamily="geist-medium"
          variant="heading"
          className="text-black dark:text-black-dark">
          Recent articles
        </Text>
        {articles.length > 0 && (
          <Button variant="icon" size="small" fullWidth={false} onPress={onShowMore}>
            <Monicon
              name="solar:alt-arrow-right-linear"
              size={18}
              strokeWidth={2.4}
              color={greyColor}
            />
          </Button>
        )}
      </View>

      {isLoading ? (
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
              onPress={() => onArticlePress(article.id)}
              className="mr-4"
              style={{ width: CARD_WIDTH }}
            />
          )}
          keyExtractor={(item) => item.id}
        />
      ) : (
        <EmptyState
          icon="solar:document-text-linear"
          message="No recent articles available"
          className="py-8"
        />
      )}
    </View>
  );
}
