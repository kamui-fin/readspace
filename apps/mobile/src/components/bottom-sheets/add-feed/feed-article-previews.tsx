import { Card } from '@components/ui/card';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { stripHtml } from '@lib/utils/html';
import { type FeedPreviewArticle, formatRelativeDate } from '@readspace/shared';
import { useMemo } from 'react';
import { Linking, View } from 'react-native';

function publishedTime(article: FeedPreviewArticle): number {
  const time = article.published_at ? Date.parse(article.published_at) : NaN;
  return Number.isFinite(time) ? time : 0;
}

export function FeedArticlePreviews({ articles }: { articles: FeedPreviewArticle[] }) {
  const recentArticles = useMemo(
    () => [...articles].sort((a, b) => publishedTime(b) - publishedTime(a)).slice(0, 10),
    [articles]
  );

  return (
    <View className="mt-6">
      <Text fontFamily="geist-semibold" size="base" className="mb-1">
        Recent articles
      </Text>
      {recentArticles.length === 0 ? (
        <Text size="sm" className="text-grey py-4">
          No recent articles available.
        </Text>
      ) : (
        recentArticles.map((article, index) => (
          <Card
            key={`${article.guid || article.link}-${index}`}
            variant="article"
            showFeedIcon={false}
            title={stripHtml(article.title) || 'Untitled article'}
            description={stripHtml(article.description) || undefined}
            imageUrl={article.image_url || undefined}
            timestamp={
              publishedTime(article)
                ? formatRelativeDate(new Date(article.published_at!))
                : undefined
            }
            showBottomDivider={index < recentArticles.length - 1}
            accessibilityRole="link"
            disabled={!article.link}
            onPress={() => {
              Linking.openURL(article.link).catch(() => toast.error('Cannot open this article'));
            }}
          />
        ))
      )}
    </View>
  );
}
