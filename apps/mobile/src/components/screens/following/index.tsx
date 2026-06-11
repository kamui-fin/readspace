/** biome-ignore-all lint/suspicious/noExplicitAny: any is used for compatibility with the toast library */

import {
  FolderPickerBottomSheet,
  type FolderPickerBottomSheetRef,
} from '@components/bottom-sheets/folder-picker';
import { ArticleListItem } from '@components/screens/following/components/article-list-item';
import { EmptyStateView } from '@components/screens/following/components/empty-state-view';
import { ArticleCardSkeletonList } from '@components/screens/following/ui/article-card.skeleton';
import { InfiniteScrollList } from '@components/ui/infinite-scroll-list';
import { toast } from '@components/ui/toast';
import { useArticleQueries } from '@hooks/useArticleQueries';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { useScrollReset } from '@hooks/useScrollReset';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { createListItems, type ListItem, processArticles } from '@lib/utils/article';
import {
  useCreateFeed,
  useFeed,
  useFeeds,
  useRefreshFeed,
  useUnreadCounts,
  useUpdateArticle,
} from '@readspace/shared';
import { useFeedViewStore } from '@stores/feed-view';
import { getTabKey, useFollowingStore } from '@stores/following';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  RefreshControl,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FollowingScreenProps {
  activeTab: number;
  scrollY: SharedValue<number>;
  headerHeight: number;
  safeMinimumHeight: number;
}

export function FollowingScreen({
  activeTab,
  scrollY,
  headerHeight,
  safeMinimumHeight,
}: FollowingScreenProps) {
  const listRef = useRef<any>(null);
  const insets = useSafeAreaInsets();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const folderPickerRef = useRef<FolderPickerBottomSheetRef>(null);

  // Refs for tracking state
  const isResettingRef = useRef(false);
  const isRefreshingRef = useRef(false);

  const prevIsLoadingRef = useRef(false);
  const prevArticleCountRef = useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(Date.now());
  const prevRefreshingRef = useRef(false);
  const firstArticleIdBeforeRefreshRef = useRef<string | undefined>(undefined);
  const articleCountBeforeRefreshRef = useRef<number>(0);

  // Get state and actions from Zustand stores
  const tabKey = getTabKey(activeTab);
  const filter = useFollowingStore((state) => state.filter);
  const isLoadingMore = useFollowingStore((state) => state.isLoadingMore);
  const setLoadingState = useFollowingStore((state) => state.setLoadingState);
  const setArticleCount = useFollowingStore((state) => state.setArticleCount);
  const setIsLoadingMore = useFollowingStore((state) => state.setIsLoadingMore);

  // Feed view store for preview mode and feed/folder views
  const viewType = useFeedViewStore((state) => state.viewType);
  const selectedId = useFeedViewStore((state) => state.selectedId);
  const selectedName = useFeedViewStore((state) => state.selectedName);
  const isPreviewMode = useFeedViewStore((state) => state.isPreviewMode);

  // Check if we're viewing a specific feed or folder
  const isViewingFeedOrFolder =
    (viewType === 'feed' || viewType === 'folder' || viewType === 'feedPreview') && !!selectedId;

  // Compute safe padding that always has a fallback
  // Uses headerHeight if available (> 0), otherwise falls back to safeMinimumHeight
  // This handles all edge cases: initial render, tab switches, remeasurements
  const contentPaddingTop = useMemo(() => {
    return headerHeight > 0 ? headerHeight : safeMinimumHeight;
  }, [headerHeight, safeMinimumHeight]);

  // Compute bottom padding to account for tab bar
  // Tab bar height = BOTTOM_TABBAR_BASE_HEIGHT + 0.8 * safeAreaBottom (from BottomTabbar component)
  // Add extra spacing (16px) for better visual separation
  const contentPaddingBottom = useMemo(() => {
    const tabBarHeight = BOTTOM_TABBAR_BASE_HEIGHT + 0.8 * insets.bottom;
    return tabBarHeight + 16;
  }, [insets.bottom]);

  // Fetch feed data for preview mode banner
  const { data: feedData } = useFeed(selectedId || '', {
    enabled: isPreviewMode && !!selectedId,
  });

  // Determine query parameters based on view type
  const feedFolderParams = useMemo(() => {
    // If viewing a specific feed or feed preview
    if ((viewType === 'feed' || viewType === 'feedPreview') && selectedId) {
      return { feedId: selectedId };
    }
    // If viewing a folder
    if (viewType === 'folder' && selectedId) {
      return { folderId: selectedId };
    }
    // Default: no feed/folder filter
    return {};
  }, [viewType, selectedId]);

  // Use custom hook to manage article queries
  const { activeQuery } = useArticleQueries({
    activeTab,
    isViewingFeedOrFolder,
    feedFolderParams,
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = activeQuery;

  // Article mutations
  const updateArticle = useUpdateArticle();
  const createFeed = useCreateFeed();
  const refreshFeed = useRefreshFeed();
  const queryClient = useQueryClient();

  // Get unread counts and feeds data — subscription still needed so the
  // queries are registered as observers (enabling refetchType: 'active' to work).
  useUnreadCounts();
  useFeeds();

  // Process articles: flatten, deduplicate, and apply filters
  const allArticles = useMemo(() => {
    return processArticles(data, isViewingFeedOrFolder, activeTab, filter);
  }, [data, filter, isViewingFeedOrFolder, activeTab]);

  // Group articles by date and create flat list with sections and dividers
  const listItems = useMemo(() => {
    return createListItems(allArticles);
  }, [allArticles]);

  // Mutation handlers
  const handleFolderSelect = useCallback(
    (folderId: string | null) => {
      if (!feedData?.url) {
        toast.error('Feed URL is missing');
        return;
      }

      createFeed.mutate(
        {
          url: feedData.url,
          folder_id: folderId || '',
        },
        {
          onSuccess: () => {
            toast.success(`Following ${feedData.title}`);
            // Exit preview mode
            const { selectFeed } = useFeedViewStore.getState();
            selectFeed(feedData.id, feedData.title);
          },
          onError: (error: any) => {
            toast.error(error?.message || 'Failed to follow feed');
          },
        }
      );
    },
    [feedData, createFeed]
  );

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
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setRefreshing(true);
    firstArticleIdBeforeRefreshRef.current = allArticles[0]?.id;
    articleCountBeforeRefreshRef.current = allArticles.length;
    try {
      // Perform a deep refresh for individual feed views
      if (viewType === 'feed' && selectedId) {
        try {
          await refreshFeed.mutateAsync({ feedId: selectedId, forceRefetch: true });
        } catch (error) {
          console.error('Deep refresh failed:', error);
        }
      }
      // Invalidate before refetching so staleTime doesn't prevent a network request.
      // The 5-min global staleTime means bare refetch() calls may read from cache.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rss-articles'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['rss-unread-counts'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['rss-feeds', 'list'], refetchType: 'active' }),
      ]);
    } finally {
      setRefreshing(false);
      isRefreshingRef.current = false;
      setLastRefreshedAt(Date.now());
    }
  }, [queryClient, viewType, selectedId, refreshFeed, allArticles]);

  // Sync loading state and article count to store
  useEffect(() => {
    setLoadingState(tabKey, isLoading);
  }, [isLoading, tabKey, setLoadingState]);

  useEffect(() => {
    setArticleCount(tabKey, allArticles.length);
  }, [allArticles.length, tabKey, setArticleCount]);

  // Sync loading state and article count
  useEffect(() => {
    // Always clear loading state when isFetchingNextPage becomes false
    if (isLoadingMore && !isFetchingNextPage) {
      setIsLoadingMore(false);
    }

    prevIsLoadingRef.current = isLoading;
    prevArticleCountRef.current = allArticles.length;
  }, [isLoading, allArticles.length, isFetchingNextPage, isLoadingMore, setIsLoadingMore]);

  // Refetch active query and associated data when screen receives focus.
  // Use invalidateQueries instead of bare refetch() so we bypass the 5-min
  // global staleTime and always get fresh data from the server on focus.
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['rss-articles'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['rss-unread-counts'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['rss-feeds', 'list'], refetchType: 'active' });
      setLastRefreshedAt(Date.now());
    }, [queryClient])
  );

  // Handle automatic scroll to top after a manual refresh completes and finds new/more articles
  useEffect(() => {
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;

    if (prevRefreshingRef.current && !refreshing) {
      const currentFirstId = allArticles[0]?.id;
      const currentCount = allArticles.length;

      const foundNewArticles =
        (currentFirstId && currentFirstId !== firstArticleIdBeforeRefreshRef.current) ||
        currentCount > articleCountBeforeRefreshRef.current;

      if (foundNewArticles) {
        const scrollToTop = () => {
          try {
            listRef.current?.scrollToOffset({ offset: 0, animated: true });
            scrollY.value = 0;
          } catch {
            // Ignore if list/ref is not ready yet
          }
        };

        // Try immediately
        scrollToTop();

        // Try after 100ms (to let the refresh control dismiss animation start)
        t1 = setTimeout(scrollToTop, 100);

        // Try after 300ms (to let the refresh control dismiss animation finish and layout settle)
        t2 = setTimeout(scrollToTop, 300);
      }
    }
    prevRefreshingRef.current = refreshing;

    return () => {
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [refreshing, allArticles, scrollY]);

  // Track the first article to detect when new articles are added at the top (e.g., after refresh)
  const previousFirstArticleRef = useRef<{
    id: string;
    published_at?: string | Date | null;
  } | null>(null);

  useEffect(() => {
    // Only check if we are not actively loading a next page from pagination,
    // and we aren't already resetting the scroll via useScrollReset
    if (
      !isFetchingNextPage &&
      !isLoadingMore &&
      !isResettingRef.current &&
      allArticles.length > 0
    ) {
      const currentFirst = allArticles[0];
      const prevFirst = previousFirstArticleRef.current;

      if (
        prevFirst &&
        prevFirst.id !== currentFirst.id &&
        currentFirst.published_at &&
        prevFirst.published_at
      ) {
        const currentTime = new Date(currentFirst.published_at).getTime();
        const prevTime = new Date(prevFirst.published_at).getTime();

        // If the new first article is newer than the previous first article
        if (currentTime > prevTime) {
          // New articles arrived (likely from a refresh), scroll to the top
          listRef.current?.scrollToOffset({ offset: 0, animated: true });
          scrollY.value = 0;
        }
      }

      previousFirstArticleRef.current = {
        id: currentFirst.id,
        published_at: currentFirst.published_at,
      };
    } else if (allArticles.length === 0) {
      previousFirstArticleRef.current = null;
    } else if (allArticles.length > 0) {
      // Also update the ref if we are just resetting, so we don't inappropriately
      // trigger a scroll to top when useScrollReset finishes
      const currentFirst = allArticles[0];
      previousFirstArticleRef.current = {
        id: currentFirst.id,
        published_at: currentFirst.published_at,
      };
    }
  }, [allArticles, isFetchingNextPage, isLoadingMore, scrollY]);

  const handleEndReached = () => {
    // Prevent multiple simultaneous fetches
    if (hasNextPage && !isFetchingNextPage && !isLoadingMore) {
      setIsLoadingMore(true);
      const previousCount = allArticles.length;
      prevArticleCountRef.current = previousCount;

      // Fetch next page
      fetchNextPage().catch(() => {
        setIsLoadingMore(false);
      });
    }
  };

  // Reset scroll position when tab, filter, or view changes
  useScrollReset({
    listRef,
    scrollY,
    isResettingRef,
    dependencies: [activeTab],
  });

  useScrollReset({
    listRef,
    scrollY,
    isResettingRef,
    dependencies: [filter],
  });

  useScrollReset({
    listRef,
    scrollY,
    isResettingRef,
    dependencies: [viewType, selectedName],
  });

  // Use regular function instead of useAnimatedScrollHandler for LegendList compatibility
  // Add safeguards to prevent edge cases where scrollY might be non-zero when it shouldn't be
  const scrollHandler = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Ignore scroll events during reset to prevent race conditions
    if (isResettingRef.current) {
      return;
    }

    const currentScrollY = event.nativeEvent.contentOffset.y;

    // Trigger refresh early on iOS if pulled down past threshold (-65px is a comfortable Reddit-like threshold)
    if (Platform.OS === 'ios' && currentScrollY < -65 && !isRefreshingRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      handleRefresh();
    }

    // Clamp very small values to 0 to handle floating point precision issues
    // This prevents header from being slightly sticky when scroll is at top
    const clampedScrollY = currentScrollY < 1 ? 0 : currentScrollY;

    scrollY.value = clampedScrollY;
  };

  const renderItem = useCallback(
    (item: ListItem) => {
      return (
        <ArticleListItem
          item={item}
          onToggleRead={handleToggleRead}
          onBookmark={handleBookmark}
          lastRefreshedAt={lastRefreshedAt}
        />
      );
    },
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

  const renderEmpty = useCallback(() => {
    return (
      <EmptyStateView
        isLoading={isLoading}
        activeTab={activeTab}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        refreshColor={colors.secondary}
        contentPaddingTop={contentPaddingTop}
        contentPaddingBottom={contentPaddingBottom}
      />
    );
  }, [
    isLoading,
    activeTab,
    refreshing,
    handleRefresh,
    colors.secondary,
    contentPaddingTop,
    contentPaddingBottom,
  ]);

  return (
    <>
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
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        estimatedItemSize={200}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
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
          flexGrow: 1,
          // If empty, pass paddingTop to EmptyStateView container directly to avoid LegendList virtualization rendering issues
          paddingTop: listItems.length === 0 ? 0 : contentPaddingTop,
          // Always apply paddingBottom to account for bottom tab bar
          // Tab bar is absolutely positioned, so content needs padding to prevent overlap
          // Uses computed padding that accounts for tab bar height + safe area + spacing
          // Add extra padding if in preview mode for the banner
          paddingBottom: isPreviewMode ? contentPaddingBottom + 80 : contentPaddingBottom,
        }}
      />

      {isLoading && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(300)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.background,
            zIndex: 9,
            paddingTop: contentPaddingTop,
            paddingBottom: isPreviewMode ? contentPaddingBottom + 80 : contentPaddingBottom,
          }}>
          <ArticleCardSkeletonList count={8} />
        </Animated.View>
      )}

      {/* Folder picker modal/bottom sheet */}
      <FolderPickerBottomSheet ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
    </>
  );
}
