/** biome-ignore-all lint/suspicious/noExplicitAny: any is used for compatibility with the toast library */

import { FolderPickerBottomSheet } from '@components/bottom-sheets/folder-picker';
import {
  FolderPickerModal,
  type FolderPickerModalRef,
} from '@components/modals/folder-picker.modal';
import { ArticleCardSkeletonList } from '@components/screens/following/ui/article-card.skeleton';
import { InfiniteScrollList } from '@components/ui/infinite-scroll-list';
import { toast } from '@components/ui/toast';
import { useToast } from '@contexts/toast-provider';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import {
  useCreateFeed,
  useFeed,
  useFeeds,
  useUnreadCounts,
  useUpdateArticle,
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

import { EmptyStateView } from './components/empty-state-view';
import { ArticleListItem } from './components/article-list-item';
import { useArticleQueries } from '../../../hooks/useArticleQueries';
import { useScrollReset } from '../../../hooks/useScrollReset';
import { createListItems, processArticles, type ListItem } from '../../../lib/utils/article';

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
  const { showToast, updateToast } = useToast();
  const insets = useSafeAreaInsets();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const folderPickerRef = useRef<FolderPickerModalRef>(null);

  // Refs for tracking state
  const isResettingRef = useRef(false);
  const loadingToastIdRef = useRef<string | null>(null);
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

  // Compute safe padding that always has a fallback
  // Uses headerHeight if available (> 0), otherwise falls back to safeMinimumHeight
  // This handles all edge cases: initial render, tab switches, remeasurements
  const contentPaddingTop = useMemo(() => {
    const effectiveHeight = headerHeight > 0 ? headerHeight : safeMinimumHeight;
    return effectiveHeight + 64; // Add 64px spacing below header for first post offset
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

  // Check if we're viewing a specific feed or folder
  const isViewingFeedOrFolder =
    (viewType === 'feed' || viewType === 'folder' || viewType === 'feedPreview') && !!selectedId;

  // Determine query parameters based on view type
  const feedFolderParams = useMemo(() => {
    // If viewing a specific feed or feed preview
    if ((viewType === 'feed' || viewType === 'feedPreview') && selectedId) {
      return { feedIds: [selectedId] };
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
          folder_id: folderId || undefined,
          silent: false,
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
      await activeQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [activeQuery]);

  // Sync loading state and article count to store
  useEffect(() => {
    setLoadingState(tabKey, isLoading);
  }, [isLoading, tabKey, setLoadingState]);

  useEffect(() => {
    setArticleCount(tabKey, allArticles.length);
  }, [allArticles.length, tabKey, setArticleCount]);

  // Show toast when initial loading completes
  useEffect(() => {
    const tabName = getTabName(activeTab);

    if (prevIsLoadingRef.current && !isLoading && allArticles.length > 0) {
      toast.success(`Loaded ${allArticles.length} ${tabName}`);
    }

    if (prevIsLoadingRef.current && !isLoading && isError) {
      toast.error(`Failed to load ${tabName}`);
    }

    // Show toast when "load more" completes
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

    prevIsLoadingRef.current = isLoading;
    prevArticleCountRef.current = allArticles.length;
  }, [
    isLoading,
    allArticles.length,
    activeTab,
    isError,
    isFetchingNextPage,
    isLoadingMore,
    setIsLoadingMore,
    updateToast,
  ]);

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
      {Platform.OS === 'ios' ? (
        <FolderPickerModal ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
      ) : (
        <FolderPickerBottomSheet ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
      )}
    </>
  );
}
