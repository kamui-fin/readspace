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
  useUnreadCounts,
  useUpdateArticle,
  useRefreshFeed,
} from '@readspace/shared';
import { useFeedViewStore } from '@stores/feed-view';
import { getTabKey, getTabName, useFollowingStore } from '@stores/following';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  RefreshControl,
  View,
} from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
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

  const prevIsLoadingRef = useRef(false);
  const prevArticleCountRef = useRef(0);
  const [refreshing, setRefreshing] = useState(false);

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
    const effectiveHeight = headerHeight > 0 ? headerHeight : safeMinimumHeight;
    // Reduce extra spacing when viewing feed/folder (8px vs 64px)
    const extraSpacing = isViewingFeedOrFolder ? 8 : 64;
    return effectiveHeight + extraSpacing;
  }, [headerHeight, safeMinimumHeight, isViewingFeedOrFolder]);

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

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = activeQuery;

  // Article mutations
  const updateArticle = useUpdateArticle();
  const createFeed = useCreateFeed();
  const refreshFeed = useRefreshFeed();

  // Get unread counts and feeds data - kept for potential future use
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
    setRefreshing(true);
    try {
      // Perform a deep refresh for individual feed views
      if (viewType === 'feed' && selectedId) {
        try {
          await refreshFeed.mutateAsync({ feedId: selectedId, forceRefetch: true });
        } catch (error) {
          console.error('Deep refresh failed:', error);
        }
      }
      await activeQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [activeQuery, viewType, selectedId, refreshFeed]);

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

  // Track the first article to detect when new articles are added at the top (e.g., after refresh)
  const previousFirstArticleRef = useRef<{ id: string; published_at?: string | Date | null } | null>(null);

  useEffect(() => {
    // Only check if we are not actively loading a next page from pagination,
    // and we aren't already resetting the scroll via useScrollReset
    if (!isFetchingNextPage && !isLoadingMore && !isResettingRef.current && allArticles.length > 0) {
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
        published_at: currentFirst.published_at
      };
    } else if (allArticles.length === 0) {
      previousFirstArticleRef.current = null;
    } else if (allArticles.length > 0) {
      // Also update the ref if we are just resetting, so we don't inappropriately
      // trigger a scroll to top when useScrollReset finishes
      const currentFirst = allArticles[0];
      previousFirstArticleRef.current = {
        id: currentFirst.id,
        published_at: currentFirst.published_at
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

    // Clamp very small values to 0 to handle floating point precision issues
    // This prevents header from being slightly sticky when scroll is at top
    const clampedScrollY = currentScrollY < 1 ? 0 : currentScrollY;

    scrollY.value = clampedScrollY;
  };

  const renderItem = useCallback(
    (item: ListItem) => {
      return (
        <ArticleListItem item={item} onToggleRead={handleToggleRead} onBookmark={handleBookmark} />
      );
    },
    [handleToggleRead, handleBookmark]
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
      />
    );
  }, [isLoading, activeTab, refreshing, handleRefresh, colors.secondary]);

  // If empty and not loading, render empty state outside scrollable list
  // This prevents scrolling on empty state and ensures header stays in place
  const isEmptyState = !isLoading && listItems.length === 0;

  if (isEmptyState) {
    return (
      <>
        {renderEmpty()}

        {/* Folder picker bottom sheet */}
        <FolderPickerBottomSheet ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
      </>
    );
  }

  return (
    <>
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
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.secondary}
            colors={[colors.secondary]}
          />
        }
        contentContainerStyle={{
          // Always apply paddingTop to account for header height
          // Header is always absolute for tabbed variant, so content needs padding
          // Uses computed safe padding that handles all edge cases:
          // - Initial render (headerHeight = 0) → uses safeMinimumHeight
          // - Tab switches (headerHeight might temporarily be 0) → uses safeMinimumHeight
          // - Normal state (headerHeight > 0) → uses actual headerHeight
          paddingTop: contentPaddingTop,
          // Always apply paddingBottom to account for bottom tab bar
          // Tab bar is absolutely positioned, so content needs padding to prevent overlap
          // Uses computed padding that accounts for tab bar height + safe area + spacing
          // Add extra padding if in preview mode for the banner
          paddingBottom: isPreviewMode ? contentPaddingBottom + 80 : contentPaddingBottom,
        }}
      />

      {/* Folder picker modal/bottom sheet */}
      <FolderPickerBottomSheet ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
    </>
  );
}
