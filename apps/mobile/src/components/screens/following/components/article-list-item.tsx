import { ArticleItemCard } from '@components/screens/following/ui/article-item.card';
import { Divider } from '@components/ui/divider';
import { Text } from '@components/ui/text';
import { useFavicon } from '@hooks/useFavicon';
import type { ListItem } from '@lib/utils/article';
import type { Article } from '@readspace/shared';
import { formatRelativeDate } from '@readspace/shared';
import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

interface ArticleListItemProps {
  item: ListItem;
  onToggleRead: (
    articleId: string,
    currentlyRead: boolean,
    articleType: 'feed' | 'clipped'
  ) => void;
  onBookmark: (articleId: string, currentlySaved: boolean, articleType: 'feed' | 'clipped') => void;
  /** When true, articles won't be greyed out even if is_read=true */
  hideReadState?: boolean;
}

export function ArticleListItem({
  item,
  onToggleRead,
  onBookmark,
  hideReadState = false,
}: ArticleListItemProps) {
  // Optimistically set read state instantly on click while backend handles it.
  const [hasMarkedRead, setHasMarkedRead] = useState(false);

  if (item.type === 'section') {
    return (
      <View className="px-4 pb-2 pt-4">
        <Text
          size="md"
          fontFamily="geist-semibold"
          className="text-secondary">
          {item.sectionTitle}
        </Text>
      </View>
    );
  }

  if (item.type === 'divider') {
    return <Divider className="mx-4" />;
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
      <Link href={`/(protected)/articles/${article.id}`} asChild>
        <ArticleItemCard
          article={article}
          isRead={hideReadState ? false : article.is_read || hasMarkedRead}
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
            // Immediately mark as read locally for instantaneous feedback
            // when returning to the list (backend syncs separately).
            if (!article.is_read) {
              setHasMarkedRead(true);
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
      </Link>
    );
  }

  return <View />;
}
function extractFeedInfo(article: any): { feedTitle: any; feedImageUrl: any } {
  return {
    feedTitle:
      article.feed_title ||
      (typeof article.feed === 'object' && article.feed ? article.feed.title : undefined),
    feedImageUrl:
      article.feed_icon ||
      (typeof article.feed === 'object' && article.feed ? article.feed.image_url : undefined),
  };
}
