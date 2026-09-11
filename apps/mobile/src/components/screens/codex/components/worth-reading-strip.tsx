import { Card } from '@components/ui/card/index';
import { Text } from '@components/ui/text';
import { useFavicon } from '@hooks/useFavicon';
import { type CodexWorthReadingItem, formatRelativeDate } from '@readspace/shared';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

interface WorthReadingStripProps {
  items: CodexWorthReadingItem[];
}

function WorthReadingRow({
  item,
  showTopDivider,
}: {
  item: CodexWorthReadingItem;
  showTopDivider: boolean;
}) {
  const router = useRouter();
  const { article, reason } = item;
  const { iconUrl, fallbackComponent } = useFavicon({
    url: article.link || '',
    feedTitle: article.feed_title || undefined,
    feedImage: article.feed_icon || undefined,
    isClipped: false,
  });

  return (
    <Card
      variant="article"
      title={article.title || article.link}
      // The reason it stands alone *is* the standfirst here — showing the article's own
      // description underneath it would just stack two summaries on top of each other.
      description={reason || article.description || undefined}
      imageUrl={article.image_url || undefined}
      timestamp={
        article.published_at ? formatRelativeDate(new Date(article.published_at)) : undefined
      }
      feedName={article.feed_title || article.source_domain || undefined}
      faviconUrl={iconUrl}
      fallbackComponent={fallbackComponent}
      showTopDivider={showTopDivider}
      showBottomDivider={false}
      onPress={() => router.push(`/(protected)/articles/${article.id}`)}
    />
  );
}

/**
 * Standalone pieces that never clustered, each with one plain line on why it stands alone —
 * a flat list on the page, the same row layout as the Following feed.
 */
export function WorthReadingStrip({ items }: WorthReadingStripProps) {
  if (items.length === 0) return null;

  return (
    <View>
      <Text
        size="xs"
        fontFamily="mono-medium"
        className="text-grey mb-2 uppercase"
        style={{ letterSpacing: 1 }}>
        Worth reading
      </Text>
      {items.map((item, i) => (
        <WorthReadingRow key={item.article.id} item={item} showTopDivider={i > 0} />
      ))}
    </View>
  );
}
