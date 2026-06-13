/** biome-ignore-all lint/suspicious/noExplicitAny: any is used for compatibility with the toast library */

import HistoryBrokenIcon from '@components/icons/solar/history-broken';
import { Header } from '@components/navigation/header';
import { ArticleListItem } from '@components/screens/following/components/article-list-item';
import { ArticleCardSkeletonList } from '@components/screens/following/ui/article-card.skeleton';
import { InfiniteScrollList } from '@components/ui/infinite-scroll-list';
import { toast } from '@components/ui/toast';
import { useToast } from '@contexts/toast-provider';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { createListItems, type ListItem } from '@lib/utils/article';
import type { Article } from '@readspace/shared';
import { useInfiniteRecentlyReadArticles, useUpdateArticle } from '@readspace/shared';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/ui/empty-state';

export function RecentsScreen() {
  const listRef = useRef<any>(null);
  const { showToast, updateToast } = useToast();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const loadingToastIdRef = useRef<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(Date.now());
  const isRefreshingRef = useRef(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const prevArticleCountRef = useRef(0);

  // Focus effect to update relative timestamps reference time when screen is focused
  useFocusEffect(
    useCallback(() => {
      setLastRefreshedAt(Date.now());
    }, [])
  );

  // Compute bottom padding to account for tab bar (matches FollowingScreen)
  const contentPaddingBottom = useMemo(() => {
    const tabBarHeight = BOTTOM_TABBAR_BASE_HEIGHT + 0.8 * insets.bottom;
    return tabBarHeight + 16;
  }, [insets.bottom]);

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
    const uniqueArticles = new Map<string, Article>();
    for (const article of articles) {
      if (!uniqueArticles.has(article.id)) {
        uniqueArticles.set(article.id, article);
      }
    }
    return Array.from(uniqueArticles.values());
  }, [data]);

  // Group by read_at date — remap read_at → published_at so createListItems groups correctly
  const listItems: ListItem[] = useMemo(() => {
    const remapped = allArticles.map((article) => ({
      ...article,
      published_at: article.read_at ?? article.published_at,
    }));
    return createListItems(remapped as Article[]);
  }, [allArticles]);

  // Mutation handlers
  const handleBookmark = useCallback(
    (articleId: string, currentlySaved: boolean, articleType: 'feed' | 'clipped' = 'feed') => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newValue = !currentlySaved;
      updateArticle.mutate(
        { articleId, data: { is_saved: newValue }, articleType },
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
        { articleId, data: { is_read: newValue }, articleType },
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
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await refetch();
    } finally {
      // Add a small delay on iOS before dismissing RefreshControl to let the layout settle.
      // This prevents the scroll view from stuttering or getting stuck halfway during the dismiss animation.
      if (Platform.OS === 'ios') {
        setTimeout(() => {
          setRefreshing(false);
          isRefreshingRef.current = false;
        }, 150);
      } else {
        setRefreshing(false);
        isRefreshingRef.current = false;
      }
      setLastRefreshedAt(Date.now());
    }
  }, [refetch]);

  // Show toast when "load more" completes
  useEffect(() => {
    if (isLoadingMore && !isFetchingNextPage) {
      if (loadingToastIdRef.current) {
        if (allArticles.length > prevArticleCountRef.current) {
          const loadedCount = allArticles.length - prevArticleCountRef.current;
          updateToast(loadingToastIdRef.current, {
            type: 'success',
            title: `Loaded ${loadedCount} more article${loadedCount !== 1 ? 's' : ''}`,
            duration: 3000,
          });
        } else {
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

  // Reset scroll to top when loading finishes (e.g. after login or initial mount)
  // This ensures the list starts perfectly at the top once data is populated.
  useEffect(() => {
    if (!isLoading) {
      const scrollToTop = () => {
        try {
          listRef.current?.scrollToOffset({ offset: 0, animated: false });
        } catch {
          // Ignore if ref is not ready
        }
      };

      scrollToTop();
      const t = setTimeout(scrollToTop, 100);
      return () => clearTimeout(t);
    }
  }, [isLoading]);

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage && !isLoadingMore) {
      setIsLoadingMore(true);
      prevArticleCountRef.current = allArticles.length;

      loadingToastIdRef.current = showToast({
        type: 'promise',
        title: 'Loading more articles...',
        duration: 999999,
      });

      fetchNextPage().catch(() => {
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



  const renderItem = useCallback(
    (item: ListItem) => (
      <ArticleListItem
        item={item}
        onToggleRead={handleToggleRead}
        onBookmark={handleBookmark}
        hideReadState
        lastRefreshedAt={lastRefreshedAt}
      />
    ),
    [handleToggleRead, handleBookmark, lastRefreshedAt]
  );

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
        <View style={{ flex: 1, minHeight: 400 }}>
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
    <Header variant="static" title="Recents" subtitle="Articles you've read" />
  );

  return (
    <View className="bg-background flex-1" style={{ backgroundColor: colors.background }}>
      <InfiniteScrollList
        key={isDark ? 'dark' : 'light'}
        ref={listRef}
        style={{ backgroundColor: colors.background }}
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
        className="bg-background"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.secondary}
            colors={[colors.secondary]}
            progressBackgroundColor={isDark ? colors.grey6 : '#ffffff'}
          />
        }
        contentContainerStyle={{
          backgroundColor: colors.background,
          paddingBottom: contentPaddingBottom,
        }}
      />
    </View>
  );
}
