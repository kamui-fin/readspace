/** biome-ignore-all lint/suspicious/noExplicitAny: any is used for compatibility with the toast library */

import { Header } from '@components/navigation/header';
import { EmptyState } from '@/components/ui/empty-state';
import HistoryBrokenIcon from '@components/icons/solar/history-broken';
import { ArticleCardSkeletonList } from '@components/screens/following/ui/article-card.skeleton';
import { ArticleItemCard } from '@components/screens/following/ui/article-item.card';
import { InfiniteScrollList } from '@components/ui/infinite-scroll-list';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useToast } from '@contexts/toast-provider';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { groupArticlesByDate } from '@lib/utils/date';
import type { Article } from '@readspace/shared';
import {
  formatRelativeDate,
  useInfiniteRecentlyReadArticles,
  useUpdateArticle,
} from '@readspace/shared';
import * as Haptics from 'expo-haptics';
import { useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ListItem {
  type: 'section' | 'article' | 'divider';
  id: string;
  data?: Article;
  sectionTitle?: string;
}

export function RecentsScreen() {
  const router = useRouter();
  const segments = useSegments();
  const listRef = useRef<any>(null);
  const { showToast, updateToast } = useToast();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const loadingToastIdRef = useRef<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const prevArticleCountRef = useRef(0);

  // Compute bottom padding to account for tab bar
  const contentPaddingBottom = useMemo(() => {
    const tabBarHeight = BOTTOM_TABBAR_BASE_HEIGHT;
    return tabBarHeight;
  }, []);

  // Fetch recently read articles
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } =
    useInfiniteRecentlyReadArticles({ limit: 25 }, {} as any);

  // Article mutations
  const updateArticle = useUpdateArticle();

  // Flatten paginated articles and deduplicate by ID
  const allArticles = useMemo(() => {
    const infiniteData = data as any;
    if (!infiniteData?.pages) return [];
    const articles = infiniteData.pages.flatMap((page: { items?: Article[] }) => page.items || []);
    // Deduplicate articles by ID
    const uniqueArticles = new Map<string, Article>();
    for (const article of articles) {
      if (!uniqueArticles.has(article.id)) {
        uniqueArticles.set(article.id, article);
      }
    }
    return Array.from(uniqueArticles.values());
  }, [data]);

  // Group articles by date and create flat list with sections and dividers
  const listItems = useMemo(() => {
    type ArticleWithDate = Article & { date: Date };
    const articlesWithDates: ArticleWithDate[] = allArticles.map((article: Article) => ({
      ...article,
      date: article.read_at
        ? new Date(article.read_at)
        : article.published_at
          ? new Date(article.published_at)
          : new Date(),
    }));
    const grouped = groupArticlesByDate(articlesWithDates);
    const items: ListItem[] = [];
    let dividerCounter = 0;

    // Sort section headers chronologically (most recent first)
    const sortedSections = Object.entries(grouped).sort((a, b) => {
      const firstArticleA = a[1][0];
      const firstArticleB = b[1][0];
      return firstArticleB.date.getTime() - firstArticleA.date.getTime();
    });

    for (let sectionIndex = 0; sectionIndex < sortedSections.length; sectionIndex++) {
      const [sectionTitle, articles] = sortedSections[sectionIndex];
      const isLastSection = sectionIndex === sortedSections.length - 1;

      // Add section header
      items.push({
        type: 'section',
        id: `section-${sectionTitle}`,
        sectionTitle,
      });

      // Add articles with dividers
      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        items.push({
          type: 'article',
          id: article.id,
          data: article,
        });

        // Add divider after each article except the last one
        if (i < articles.length - 1) {
          items.push({
            type: 'divider',
            id: `divider-${dividerCounter++}`,
          });
        }
      }

      // Add divider after section (before next section) only if not the last section
      if (!isLastSection) {
        items.push({
          type: 'divider',
          id: `divider-${dividerCounter++}`,
        });
      }
    }

    return items;
  }, [allArticles]);

  // Mutation handlers
  const handleBookmark = useCallback(
    (articleId: string, currentlySaved: boolean, articleType: 'feed' | 'clipped' = 'feed') => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const newValue = !currentlySaved;
      updateArticle.mutate(
        {
          articleId,
          data: { is_saved: newValue },
          articleType,
        },
        {
          onError: () => {
            toast.error('Failed to update bookmark');
          },
        }
      );
    },
    [updateArticle]
  );

  const handleToggleRead = useCallback(
    (articleId: string, currentlyRead: boolean, articleType: 'feed' | 'clipped' = 'feed') => {
      const newValue = !currentlyRead;
      updateArticle.mutate(
        {
          articleId,
          data: { is_read: newValue },
          articleType,
        },
        {
          onError: () => {
            toast.error('Failed to update read status');
          },
        }
      );
    },
    [updateArticle]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Show toast when "load more" completes
  useEffect(() => {
    if (isLoadingMore && !isFetchingNextPage) {
      // Always clear loading state when isFetchingNextPage becomes false
      if (loadingToastIdRef.current) {
        if (allArticles.length > prevArticleCountRef.current) {
          const loadedCount = allArticles.length - prevArticleCountRef.current;
          // Update the promise toast with the actual count
          updateToast(loadingToastIdRef.current, {
            type: 'success',
            title: `Loaded ${loadedCount} more article${loadedCount !== 1 ? 's' : ''}`,
            duration: 3000,
          });
        } else {
          // No new articles loaded, dismiss the toast
          updateToast(loadingToastIdRef.current, {
            type: 'error',
            title: 'No more articles',
            duration: 2000,
          });
        }
        loadingToastIdRef.current = null;
      }
      setIsLoadingMore(false);
    }

    prevArticleCountRef.current = allArticles.length;
  }, [isFetchingNextPage, isLoadingMore, allArticles.length, updateToast]);

  const handleEndReached = () => {
    // Prevent multiple simultaneous fetches
    if (hasNextPage && !isFetchingNextPage && !isLoadingMore) {
      setIsLoadingMore(true);
      const previousCount = allArticles.length;
      prevArticleCountRef.current = previousCount;

      // Show loading toast and store the toastId
      loadingToastIdRef.current = showToast({
        type: 'promise',
        title: 'Loading more articles...',
        duration: 999999, // Keep visible until we update it
      });

      // Fetch next page
      fetchNextPage().catch(() => {
        // On error, update toast to show error
        if (loadingToastIdRef.current) {
          updateToast(loadingToastIdRef.current, {
            type: 'error',
            title: 'Failed to load more articles',
            duration: 3000,
          });
          loadingToastIdRef.current = null;
        }
        setIsLoadingMore(false);
      });
    }
  };

  const renderItem = (item: ListItem) => {
    if (item.type === 'section') {
      return (
        <View className="bg-background dark:bg-background-dark px-4 pb-2">
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

      // Use read_at if available, otherwise fall back to published_at
      const timestampDate = article.read_at
        ? new Date(article.read_at)
        : article.published_at
          ? new Date(article.published_at)
          : new Date();
      const timestamp = formatRelativeDate(timestampDate);

      // Only use article image_url, not feed image_url
      const displayImageUrl = article.image_url || undefined;

      // Extract feed information
      const feedTitle =
        typeof (article as any).feed === 'object' && (article as any).feed
          ? (article as any).feed.title || undefined
          : undefined;
      const feedImageUrl =
        typeof (article as any).feed === 'object' && (article as any).feed
          ? (article as any).feed.image_url || undefined
          : undefined;

      // Try multiple ways to get the feed ID
      let feedId: string | undefined;
      if (typeof (article as any).feed === 'object' && (article as any).feed) {
        feedId = ((article as any).feed as any).id;
      } else if (typeof (article as any).feed === 'string') {
        feedId = (article as any).feed;
      }

      // Check if there's a feed_id field directly on the article
      if (!feedId && (article as any).feed_id) {
        feedId = (article as any).feed_id;
      }

      // For clipped articles - get favicon from domain
      const getFaviconUrl = (url: string): string => {
        try {
          const domain = new URL(url).hostname;
          return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        } catch {
          return '';
        }
      };

      // Use favicon from clipped article domain, or feed image, or fallback to feed domain favicon
      let displayFaviconUrl: string | undefined;
      if (isClipped && article.link) {
        displayFaviconUrl = getFaviconUrl(article.link);
      } else if (feedImageUrl) {
        displayFaviconUrl = feedImageUrl;
      } else if (typeof (article as any).feed === 'object' && (article as any).feed && ((article as any).feed as any).link) {
        // Fallback: generate favicon from feed's website URL
        displayFaviconUrl = getFaviconUrl(((article as any).feed as any).link);
      }

      return (
        <ArticleItemCard
          article={article}
          imageUrl={displayImageUrl}
          title={article.title || undefined}
          description={article.description || undefined}
          timestamp={timestamp}
          faviconUrl={displayFaviconUrl}
          feedName={feedTitle}
          className="px-4"
          showTopDivider={false}
          showBottomDivider={false}
          onPress={() => {
            const articleRoute = `/(protected)/articles/${article.id}`;
            // Prevent duplicate navigation - check if already on this route
            const currentPath = segments.join('/');
            const articlePath = `articles/${article.id}`;
            // Only navigate if not already on this article route
            if (!currentPath.includes(articlePath)) {
              router.push(articleRoute as any);
            }
          }}
          onMarkAsRead={(article) => {
            handleToggleRead(article.id, article.is_read || false, article.article_type as any);
          }}
          onMarkAsUnread={(article) => {
            handleToggleRead(article.id, article.is_read || false, article.article_type as any);
          }}
          onSaveArticle={(article) => {
            handleBookmark(article.id, article.is_saved || false, article.article_type as any);
          }}
        />
      );
    }

    return <View />;
  };

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View className="py-4">
        <ArticleCardSkeletonList count={3} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View
          style={{
            flex: 1,
            minHeight: 400,
          }}>
          <ArticleCardSkeletonList count={8} />
        </View>
      );
    }

    return (
      <EmptyState
        variant="centered"
        icon={HistoryBrokenIcon}
        message="No recently read articles."
      />
    );
  };

  const renderHeader = () => (
    <View style={{ paddingTop: insets.top }}>
      <Header variant="static" title="Recents" subtitle="Articles you've read" />
    </View>
  );

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <InfiniteScrollList
        ref={listRef}
        data={listItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        onEndReached={handleEndReached}
        hasMore={hasNextPage ?? false}
        isLoading={isFetchingNextPage}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        estimatedItemSize={200}
        showsVerticalScrollIndicator={false}
        className="bg-background dark:bg-background-dark"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.secondary}
            colors={[colors.secondary]}
          />
        }
        contentContainerStyle={{
          backgroundColor: colors.background,
          // Header includes safe area padding and scrolls with list
          // As header scrolls away, content can go under the notch/status bar
          // Only apply paddingBottom to account for bottom tab bar
          paddingBottom: contentPaddingBottom,
        }}
      />
    </View>
  );
}
