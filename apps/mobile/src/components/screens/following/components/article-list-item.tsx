import { ArticleItemCard } from '@components/screens/following/ui/article-item.card';
import { Divider } from '@components/ui/divider';
import { Text } from '@components/ui/text';
import { useFavicon } from '@hooks/useFavicon';
import type { ListItem } from '@lib/utils/article';
import type { Article } from '@readspace/shared';
import { formatRelativeDate } from '@readspace/shared';
import { usePreferencesStore } from '@stores/preferences';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';

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
  /** Force re-render on list refresh or screen focus */
  lastRefreshedAt?: number;
}

export function ArticleListItem({
  item,
  onToggleRead,
  onBookmark,
  hideReadState = false,
  lastRefreshedAt,
}: ArticleListItemProps) {
  // Optimistically set read state instantly on click while backend handles it.
  const [hasMarkedRead, setHasMarkedRead] = useState(false);
  const openInBrowser = usePreferencesStore((state) => state.openInBrowser);

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

    const handlePress = () => {
      if (!article.is_read) {
        setHasMarkedRead(true);
      }
    };

    const sharedCardProps = {
      article,
      isRead: hideReadState ? false : article.is_read || hasMarkedRead,
      imageUrl: displayImageUrl,
      title: article.title || undefined,
      description: article.description || undefined,
      timestamp,
      faviconUrl: iconUrl,
      fallbackComponent,
      feedName: feedTitle,
      className: 'px-4',
      showTopDivider: false,
      showBottomDivider: false,
      onMarkAsRead: (a: typeof article) => {
        onToggleRead(a.id, a.is_read || false, a.article_type as any);
      },
      onMarkAsUnread: (a: typeof article) => {
        onToggleRead(a.id, a.is_read || false, a.article_type as any);
      },
      onSaveArticle: (a: typeof article) => {
        onBookmark(a.id, a.is_saved || false, a.article_type as any);
      },
    };

    if (openInBrowser) {
      return (
        <ArticleItemCard
          {...sharedCardProps}
          onPress={() => {
            handlePress();
            if (article.link) {
              Linking.openURL(article.link).catch(() => {});
            }
          }}
        />
      );
    }

    return (
      <Link href={`/(protected)/articles/${article.id}`} asChild>
        <ArticleItemCard {...sharedCardProps} onPress={handlePress} />
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
