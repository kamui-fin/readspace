import { ArticleItemCard } from '@components/screens/following/ui/article-item.card';
import { Text } from '@components/ui/text';
import { formatRelativeDate } from '@readspace/shared';
import type { Article } from '@readspace/shared';
import { useRouter, useSegments } from 'expo-router';
import { useRef } from 'react';
import { View } from 'react-native';

import type { ListItem } from '../../../../lib/utils/article';

interface ArticleListItemProps {
  item: ListItem;
  onToggleRead: (
    articleId: string,
    currentlyRead: boolean,
    articleType: 'feed' | 'clipped'
  ) => void;
  onBookmark: (articleId: string, currentlySaved: boolean, articleType: 'feed' | 'clipped') => void;
}

/**
 * Get favicon URL from domain
 */
function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return '';
  }
}

/**
 * Extract feed information from article
 */
function extractFeedInfo(article: Article) {
  const feedTitle =
    typeof article.feed === 'object' && article.feed ? article.feed.title || undefined : undefined;

  const feedImageUrl =
    typeof article.feed === 'object' && article.feed
      ? article.feed.image_url || undefined
      : undefined;

  // Try multiple ways to get the feed ID
  let feedId: string | undefined;
  if (typeof article.feed === 'object' && article.feed) {
    feedId = (article.feed as any).id;
  } else if (typeof article.feed === 'string') {
    feedId = article.feed;
  }

  // Check if there's a feed_id field directly on the article
  if (!feedId && (article as any).feed_id) {
    feedId = (article as any).feed_id;
  }

  return { feedTitle, feedImageUrl, feedId };
}

/**
 * Get display favicon URL for article
 */
function getDisplayFaviconUrl(article: Article, feedImageUrl?: string): string | undefined {
  const isClipped = article.article_type === 'clipped';

  // Use favicon from clipped article domain, or feed image, or fallback to feed domain favicon
  if (isClipped && article.link) {
    return getFaviconUrl(article.link);
  }

  if (feedImageUrl) {
    return feedImageUrl;
  }

  if (typeof article.feed === 'object' && article.feed && (article.feed as any).link) {
    // Fallback: generate favicon from feed's website URL
    return getFaviconUrl((article.feed as any).link);
  }

  return undefined;
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
    return <View className="mx-4 h-[0.5px] bg-light-grey dark:bg-mid-grey-dark" />;
  }

  if (item.type === 'article' && item.data) {
    const article = item.data;
    const isClipped = article.article_type === 'clipped';

    const timestamp = article.published_at
      ? formatRelativeDate(new Date(article.published_at))
      : 'Unknown';

    const displayImageUrl = article.image_url || undefined;

    const { feedTitle, feedImageUrl } = extractFeedInfo(article);
    const displayFaviconUrl = getDisplayFaviconUrl(article, feedImageUrl);

    return (
      <ArticleItemCard
        article={article}
        imageUrl={displayImageUrl}
        title={article.title}
        description={article.description || undefined}
        timestamp={timestamp}
        faviconUrl={displayFaviconUrl}
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
          onToggleRead(article.id, article.is_read || false, article.article_type);
        }}
        onMarkAsUnread={(article) => {
          onToggleRead(article.id, article.is_read || false, article.article_type);
        }}
        onSaveArticle={(article) => {
          onBookmark(article.id, article.is_read_later || false, article.article_type);
        }}
      />
    );
  }

  return <View />;
}
