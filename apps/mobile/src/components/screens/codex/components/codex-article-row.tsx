import { FeedIcon } from '@components/ui/feed-icon';
import { Text } from '@components/ui/text';
import { useFavicon } from '@hooks/useFavicon';
import { type ArticleSummary, formatRelativeDate } from '@readspace/shared';
import { Link } from 'expo-router';
import { View } from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';

interface CodexArticleRowProps {
  article: ArticleSummary;
  /** Index 0 gets the "best write-up" treatment. */
  rank?: number;
}

/**
 * One article under a Development card or in the Worth Reading strip. Lighter than the
 * library's ArticleItemCard — no image, taps through to the in-app reader.
 */
export function CodexArticleRow({ article, rank }: CodexArticleRowProps) {
  const isBest = rank === 0;
  const { iconUrl, fallbackComponent } = useFavicon({
    url: article.link || '',
    feedTitle: article.feed_title || undefined,
    feedImage: article.feed_icon || undefined,
    isClipped: false,
  });

  const published = article.published_at
    ? formatRelativeDate(new Date(article.published_at))
    : null;

  return (
    <Link href={`/(protected)/articles/${article.id}`} asChild>
      <PressableScale className="px-3 py-2.5">
        <View className="flex-row items-center gap-1.5">
          <FeedIcon
            url={iconUrl}
            fallbackComponent={fallbackComponent}
            feedName={article.feed_title || undefined}
            size={14}
          />
          <Text size="xs" className="text-grey flex-1" numberOfLines={1}>
            {article.feed_title || article.source_domain || 'Unknown source'}
          </Text>
          {published && (
            <Text size="xs" className="text-grey">
              {published}
            </Text>
          )}
          {isBest && (
            <Text size="xs" fontFamily="geist-semibold" className="text-secondary uppercase">
              Best
            </Text>
          )}
        </View>
        <Text
          size="sm"
          fontFamily={isBest ? 'geist-semibold' : 'geist-medium'}
          className="text-primary-foreground mt-1"
          numberOfLines={3}>
          {article.title || article.link}
        </Text>
      </PressableScale>
    </Link>
  );
}
