/** biome-ignore-all lint/suspicious/noExplicitAny: any is used for compatibility with the toast library */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, RefreshControl } from 'react-native';
import { useRouter, useSegments } from 'expo-router';

import { Text } from '@components/ui/text';
import { ArticleItemCard } from '@components/screens/following/ui/article-item.card';
import { InfiniteScrollList } from '@components/ui/infinite-scroll-list';
import { toast } from '@components/ui/toast';
import { useToast } from '@contexts/toast-provider';
import { useDiscoverScroll } from '@contexts/discover-scroll-context';
import { EmptyState } from '@components/screens/empty-state';
import { ArticleCardSkeletonList } from '@components/screens/following/ui/article-card.skeleton';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { groupArticlesByDate } from '@lib/utils/date';
import { COLORS } from '@lib/constants/colors';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import type { Article } from '@readspace/shared';
import {
  formatRelativeDate,
  useInfiniteRecentlyReadArticles,
  useUpdateArticle,
} from '@readspace/shared';
import { useFocusEffect } from 'expo-router';

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
  const insets = useSafeAreaInsets();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  // Get header height from context
  const { recentsHeaderHeight } = useDiscoverScroll();
  const headerHeight = recentsHeaderHeight || 0;
  const safeMinimumHeight = insets.top + 10 + 80 + 24 + 16; // ~130px + safe area (includes subtitle)

  // Track if we're in a reset state to prevent scroll handler from setting non-zero values
  const isResettingRef = useRef(false);
  const loadingToastIdRef = useRef<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const prevArticleCountRef = useRef(0);

  // Compute safe padding that always has a fallback
  // Uses headerHeight if available (> 0), otherwise falls back to safeMinimumHeight
  // This handles all edge cases: initial render, tab switches, remeasurements
  // Add 16px spacing after header to separate it from the first section header
  const contentPaddingTop = useMemo(() => {
    const effectiveHeight = headerHeight > 0 ? headerHeight : safeMinimumHeight;
    return effectiveHeight + 16; // Add spacing below header for first section
  }, [headerHeight, safeMinimumHeight]);

  // Compute bottom padding to account for tab bar
  // Tab bar height = BOTTOM_TABBAR_BASE_HEIGHT + 0.8 * safeAreaBottom (from BottomTabbar component)
  // Add extra spacing (16px) for better visual separation
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
      const newValue = !currentlySaved;
      updateArticle.mutate(
        {
          articleId,
          data: { is_read_later: newValue },
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

  // Reset scroll position when route is focused
  useFocusEffect(
    useCallback(() => {
      // Set reset flag to prevent scroll handler from interfering
      isResettingRef.current = true;

      // Scroll list to top - use multiple attempts to ensure it works
      const scrollToTop = () => {
        if (listRef.current) {
          try {
            listRef.current.scrollToOffset({ offset: 0, animated: false });
          } catch {
            // Ignore errors if list isn't ready
          }
        }
      };

      // Try immediately
      scrollToTop();

      // Also try after a short delay to ensure list is ready
      const timeoutId = setTimeout(() => {
        scrollToTop();
        // Clear reset flag after scroll operations complete
        setTimeout(() => {
          isResettingRef.current = false;
        }, 100);
      }, 50);

      return () => {
        clearTimeout(timeoutId);
        isResettingRef.current = false;
      };
    }, [])
  );

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
        typeof article.feed === 'object' && article.feed
          ? article.feed.title || undefined
          : undefined;
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
      } else if (typeof article.feed === 'object' && article.feed && (article.feed as any).link) {
        // Fallback: generate favicon from feed's website URL
        displayFaviconUrl = getFaviconUrl((article.feed as any).link);
      }

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
            handleToggleRead(article.id, article.is_read || false, article.article_type);
          }}
          onMarkAsUnread={(article) => {
            handleToggleRead(article.id, article.is_read || false, article.article_type);
          }}
          onSaveArticle={(article) => {
            handleBookmark(article.id, article.is_read_later || false, article.article_type);
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
        icon="solar:history-broken"
        message="No recently read articles."
      />
    );
  };

  // If empty and not loading, render empty state outside scrollable list
  // This prevents scrolling on empty state and ensures header stays in place
  const isEmpty = !isLoading && listItems.length === 0;

  if (isEmpty) {
    // When header is relative (scrollY = 0), it's in normal flow and takes up space
    // The empty state needs to be centered in the remaining space below the header
    // The EmptyState component with variant="centered" uses flex-1 to fill available space
    // and centers its content with items-center justify-center
    return (
      <View
        className="flex-1 bg-background dark:bg-background-dark"
        style={
          {
            // Ensure the container fills the remaining space below the header
            // The header is relative, so it takes up space, and this container
            // fills the rest of the screen
          }
        }>
        {renderEmpty()}
      </View>
    );
  }

  return (
    <InfiniteScrollList
      ref={listRef}
      data={listItems}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      onEndReached={handleEndReached}
      hasMore={hasNextPage ?? false}
      isLoading={isFetchingNextPage}
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
        // Always apply paddingTop to account for header height
        // Header is always absolute for sticky variant, so content needs padding
        // Uses computed safe padding that handles all edge cases:
        // - Initial render (headerHeight = 0) → uses safeMinimumHeight
        // - Normal state (headerHeight > 0) → uses actual headerHeight
        paddingTop: contentPaddingTop,
        // Always apply paddingBottom to account for bottom tab bar
        // Tab bar is absolutely positioned, so content needs padding to prevent overlap
        // Uses computed padding that accounts for tab bar height + safe area + spacing
        paddingBottom: contentPaddingBottom,
      }}
    />
  );
}
