/** biome-ignore-all lint/suspicious/noExplicitAny: any is used for compatibility with the toast library */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import type { SharedValue } from 'react-native-reanimated';

import { Card } from '@components/ui/card';
import { InfiniteScrollList } from '@components/ui/infinite-scroll-list';
import { toast } from '@components/ui/toast';
import { useToast } from '@contexts/toast-provider';
import { EmptyState } from '@components/screens/empty-state';
import { ArticleCardSkeletonList } from '@/components/screens/following/ui/article-card.skeleton';
import { useFollowingStore, getTabName, getTabKey } from '@stores/following';
import { useFeedViewStore } from '@stores/feed-view';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FolderPickerModal,
  type FolderPickerModalRef,
} from '@components/modals/folder-picker.modal';
import { FolderPickerBottomSheet } from '@/components/bottom-sheets/folder-picker';
import { groupArticlesByDate } from '@lib/utils/date';
import { COLORS } from '@lib/constants/colors';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import type { Article } from '@readspace/shared';
import {
  formatRelativeDate,
  useInfiniteArticles,
  useInfiniteReadLaterArticles,
  useInfiniteTodayArticles,
  useInfiniteRecentlyReadArticles,
  useUpdateArticle,
  useCreateFeed,
  useFeed,
  useUnreadCounts,
  useFeeds,
} from '@readspace/shared';

interface ListItem {
  type: 'section' | 'article' | 'divider';
  id: string;
  data?: Article;
  sectionTitle?: string;
}

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
  const router = useRouter();
  const segments = useSegments();
  const listRef = useRef<any>(null);
  const { showToast, updateToast } = useToast();
  const insets = useSafeAreaInsets();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const folderPickerRef = useRef<FolderPickerModalRef>(null);

  // Track if we're in a reset state to prevent scroll handler from setting non-zero values
  const isResettingRef = useRef(false);
  const loadingToastIdRef = useRef<string | null>(null);
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

  // Track previous loading state to detect transitions
  const prevIsLoadingRef = useRef(false);
  const prevArticleCountRef = useRef(0);

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

  // When viewing a feed/folder, we can't use the special queries (today/saved/recent)
  // because they don't support feed/folder filtering. So we always use allQuery for feed/folder views.
  // When NOT viewing a feed/folder, use the appropriate tab-specific query.

  // Select the appropriate query hook based on active tab
  const todayQuery = useInfiniteTodayArticles({ limit: 25 }, {
    enabled: activeTab === 0 && !isViewingFeedOrFolder,
  } as any);
  const savedQuery = useInfiniteReadLaterArticles({ limit: 25 }, {
    enabled: activeTab === 1 && !isViewingFeedOrFolder,
  } as any);
  const allQuery = useInfiniteArticles({ ...feedFolderParams, limit: 25 }, {
    enabled: activeTab === 2 || isViewingFeedOrFolder,
  } as any);
  const recentQuery = useInfiniteRecentlyReadArticles({ limit: 25 }, {
    enabled: activeTab === 3 && !isViewingFeedOrFolder,
  } as any);

  // Select active query based on tab
  const activeQuery = useMemo(() => {
    // When viewing a feed/folder, always use allQuery because the special queries
    // (today/saved/recent) don't support feed/folder filtering
    if (isViewingFeedOrFolder) {
      return allQuery;
    }
    // When NOT viewing a feed/folder, use the tab-specific query
    switch (activeTab) {
      case 0:
        return todayQuery;
      case 1:
        return savedQuery;
      case 2:
        return allQuery;
      case 3:
        return recentQuery;
      default:
        return allQuery;
    }
  }, [activeTab, isViewingFeedOrFolder, todayQuery, savedQuery, allQuery, recentQuery]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = activeQuery;

  // Article mutations
  const updateArticle = useUpdateArticle();
  const createFeed = useCreateFeed();

  // Get unread counts - for feed/folder specific counts
  const { data: unreadCounts } = useUnreadCounts();
  const { data: feedsData } = useFeeds();

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
    let result = Array.from(uniqueArticles.values());

    // When viewing a feed/folder, we need to apply tab-specific filters client-side
    // because the backend queries don't support feed/folder + tab filters together
    if (isViewingFeedOrFolder && activeTab !== 2) {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      if (activeTab === 0) {
        // Today: articles published in last 24 hours
        result = result.filter((article) => {
          if (!article.published_at) return false;
          const publishedDate = new Date(article.published_at);
          return publishedDate >= twentyFourHoursAgo && publishedDate <= now;
        });
      } else if (activeTab === 1) {
        // Saved: articles marked as read_later
        result = result.filter((article) => article.is_read_later);
      } else if (activeTab === 3) {
        // Recent: articles that have been read (is_read = true)
        result = result.filter((article) => article.is_read);
      }
      // activeTab === -1 or 2: show all articles (no additional filtering)
    }

    // Filter by read/unread/read_later status based on filter state
    if (filter === 'unread') {
      result = result.filter((article) => !article.is_read);
    } else if (filter === 'read') {
      result = result.filter((article) => article.is_read);
    } else if (filter === 'read_later') {
      result = result.filter((article) => article.is_read_later);
    }
    // filter === "all" shows all articles, no filtering needed

    return result;
  }, [data, filter, isViewingFeedOrFolder, activeTab]);

  // Group articles by date and create flat list with sections and dividers
  const listItems = useMemo(() => {
    type ArticleWithDate = Article & { date: Date };
    const articlesWithDates: ArticleWithDate[] = allArticles.map((article: Article) => ({
      ...article,
      date: article.published_at ? new Date(article.published_at) : new Date(),
    }));
    const grouped = groupArticlesByDate(articlesWithDates);
    const items: ListItem[] = [];
    let dividerCounter = 0;

    // Sort section headers chronologically
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
  const handleFollowFromPreview = useCallback(() => {
    folderPickerRef.current?.present();
  }, []);

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

  // Reset scroll position when tab changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollY is a stable SharedValue, only activeTab should trigger reset
  useEffect(() => {
    // Set reset flag to prevent scroll handler from interfering
    isResettingRef.current = true;

    // Reset scroll position immediately when tab changes
    scrollY.value = 0;

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
  }, [activeTab]);

  // Reset scroll position when filter changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollY is a stable SharedValue, only filter should trigger reset
  useEffect(() => {
    // Set reset flag to prevent scroll handler from interfering
    isResettingRef.current = true;

    // Reset scroll position immediately when filter changes
    scrollY.value = 0;

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
  }, [filter]);

  // Reset scroll position when feed/folder selection changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollY is a stable SharedValue, only viewType/selectedName should trigger reset
  useEffect(() => {
    // Set reset flag to prevent scroll handler from interfering
    isResettingRef.current = true;

    // Reset scroll position immediately when feed/folder selection changes
    scrollY.value = 0;

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
  }, [viewType, selectedName]);

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

  const renderItem = (item: ListItem, index: number) => {
    if (item.type === 'section') {
      return (
        <View className="px-4 pb-2 pt-4">
          <Text className="font-geist-semibold text-sm text-secondary dark:text-secondary-dark">
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

      // Debug favicon
      if (!feedImageUrl && !isClipped) {
        console.log('[Following] Missing favicon for article:', {
          articleId: article.id,
          feedType: typeof article.feed,
          hasFeed: !!article.feed,
          feedImageUrl,
        });
      }

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
        <Card
          variant="swipeable"
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

    const emptyConfigs = {
      0: {
        icon: 'solar:inbox-broken',
        message: 'No articles for today yet. Check back later!',
      },
      1: {
        icon: 'solar:bookmark-broken',
        message: 'No saved articles. Swipe right on articles to bookmark them.',
      },
      2: {
        icon: 'solar:inbox-broken',
        message: 'No articles yet. Add some feeds to get started!',
      },
      3: {
        icon: 'solar:history-broken',
        message: 'No recently read articles.',
      },
    };

    const config = emptyConfigs[activeTab as keyof typeof emptyConfigs] || {
      icon: 'solar:inbox-broken',
      message: 'No articles available.',
    };

    return <EmptyState variant="centered" icon={config.icon} message={config.message} />;
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
      <>
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
