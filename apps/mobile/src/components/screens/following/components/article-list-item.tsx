import { ArticleItemCard } from '@components/screens/following/ui/article-item.card';
import { Divider } from '@components/ui/divider';
import { PriorityBadge } from '@components/ui/priority-badge';
import { Text } from '@components/ui/text';
import { useFavicon } from '@hooks/useFavicon';
import { READ_LATER_READER_MODE } from '@lib/constants/app';
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
  hideReadState?: boolean;
  lastRefreshedAt?: number;
  /** Rendered in the Saved tab — the reader then offers "mark as read & next" */
  isReadLaterMode?: boolean;
}

export function ArticleListItem({
  item,
  onToggleRead,
  onBookmark,
  hideReadState = false,
  lastRefreshedAt,
  isReadLaterMode = false,
}: ArticleListItemProps) {
  const [hasMarkedRead, setHasMarkedRead] = useState(false);

  const article = item.type === 'article' && item.data ? item.data : null;
  const isClipped = article?.article_type === 'clipped' || false;

  const { feedTitle, feedImageUrl } = article
    ? extractFeedInfo(article)
    : { feedTitle: undefined, feedImageUrl: undefined };
  // Clipped articles have no feed; the source domain is their "feed name"
  const sourceName = isClipped ? article?.source_domain || undefined : feedTitle;

  const { iconUrl, fallbackComponent } = useFavicon({
    url: article?.link || '',
    feedTitle: sourceName,
    feedImage: feedImageUrl,
    isClipped: isClipped,
  });

  if (item.type === 'section') {
    return (
      <View className="px-4 pb-2 pt-4">
        <Text size="md" fontFamily="geist-semibold" className="text-secondary">
          {item.sectionTitle}
        </Text>
      </View>
    );
  }

  if (item.type === 'divider') {
    return <Divider className="mx-4" />;
  }

  if (item.type === 'article' && article) {
    // Saved tab shows when the article was saved, not when it was published
    const listDate = isReadLaterMode ? article.created_at : article.published_at;
    const timestamp = listDate ? formatRelativeDate(new Date(listDate)) : 'Unknown';

    const displayImageUrl = article.image_url || undefined;

    return (
      <Link
        href={{
          pathname: '/(protected)/articles/[id]',
          params: {
            id: article.id,
            type: article.article_type,
            ...(isReadLaterMode && { mode: READ_LATER_READER_MODE }),
          },
        }}
        asChild>
        <ArticleItemCard
          article={article}
          // Read state is meaningless in Read Later (like web), so don't dim there
          isRead={hideReadState || isReadLaterMode ? false : article.is_read || hasMarkedRead}
          imageUrl={displayImageUrl}
          title={article.title || undefined}
          // Like web, a clip's personal note takes the description's place
          description={
            isClipped && article.user_note ? undefined : article.description || undefined
          }
          note={isClipped ? article.user_note || undefined : undefined}
          badge={isClipped ? <PriorityBadge priority={article.priority} /> : undefined}
          timestamp={timestamp}
          faviconUrl={iconUrl}
          fallbackComponent={fallbackComponent}
          feedName={sourceName}
          className="px-4"
          showTopDivider={false}
          showBottomDivider={false}
          onPress={() => {
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
