import { ArticleItemCard } from '@components/screens/following/ui/article-item.card';
import { Text } from '@components/ui/text';
import { formatRelativeDate } from '@readspace/shared';
import type { Article } from '@readspace/shared';
import { useFavicon } from '@hooks/useFavicon';
import { useRouter, useSegments } from 'expo-router';
import { useRef } from 'react';
import { View } from 'react-native';
import type { ListItem } from '@lib/utils/article';

interface ArticleListItemProps {
  item: ListItem;
  onToggleRead: (
    articleId: string,
    currentlyRead: boolean,
    articleType: 'feed' | 'clipped'
  ) => void;
  onBookmark: (articleId: string, currentlySaved: boolean, articleType: 'feed' | 'clipped') => void;
}

export function ArticleListItem({ item, onToggleRead, onBookmark }: ArticleListItemProps) {
  const router = useRouter();
  const segments = useSegments();
  const isNavigatingRef = useRef(false);

  if (item.type === 'section') {
    return (
      <View className="px-4 pb-2 pt-4">
        <Text
          size="md"
          fontFamily="geist-semibold"
          className="text-secondary dark:text-secondary-dark">
          {item.sectionTitle}
        </Text>
      </View>
    );
  }

  if (item.type === 'divider') {
    return <View className="mx-4 h-[1px] bg-light-grey dark:bg-mid-grey-dark" />;
  }

  if (item.type === 'article' && item.data) {
    const article = item.data;
    const isClipped = article.article_type === 'clipped';

    const timestamp = article.published_at
      ? formatRelativeDate(new Date(article.published_at))
      : 'Unknown';

    const displayImageUrl = article.image_url || undefined;

    const { feedTitle, feedImageUrl } = extractFeedInfo(article);

    const { iconUrl, fallbackComponent } = useFavicon({
      url: article.link,
      feedTitle: feedTitle,
      feedImage: feedImageUrl,
      isClipped: isClipped,
    });

    return (
      <ArticleItemCard
        article={article}
        imageUrl={displayImageUrl}
        title={article.title || undefined}
        description={article.description || undefined}
        timestamp={timestamp}
        faviconUrl={iconUrl}
        fallbackComponent={fallbackComponent}
        feedName={feedTitle}
        className="px-4"
        showTopDivider={false}
        showBottomDivider={false}
        onPress={() => {
          // Prevent duplicate navigation using ref to track navigation state
          if (isNavigatingRef.current) return;

          const articleRoute = `/(protected)/articles/${article.id}`;
          const currentPath = segments.join('/');
          const articlePath = `articles/${article.id}`;

          // Only navigate if not already on this article route
          if (!currentPath.includes(articlePath)) {
            isNavigatingRef.current = true;
            router.push(articleRoute as any);

            // Reset navigation flag after a short delay
            setTimeout(() => {
              isNavigatingRef.current = false;
            }, 500);
          }
        }}
        onMarkAsRead={(article) => {
          onToggleRead(article.id, article.is_read || false, article.article_type as any);
        }}
        onMarkAsUnread={(article) => {
          onToggleRead(article.id, article.is_read || false, article.article_type as any);
        }}
        onSaveArticle={(article) => {
          onBookmark(article.id, article.is_saved || false, article.article_type as any);
        }}
      />
    );
  }

  return <View />;
}
function extractFeedInfo(article: any): { feedTitle: any; feedImageUrl: any } {
  return {
    feedTitle: typeof article.feed === 'object' && article.feed ? article.feed.title : undefined,
    feedImageUrl: typeof article.feed === 'object' && article.feed ? article.feed.image_url : undefined,
  };
}
