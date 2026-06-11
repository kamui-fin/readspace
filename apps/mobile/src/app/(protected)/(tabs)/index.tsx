import { FeedSwitcherBottomSheet } from '@components/bottom-sheets/feed-switcher';
import RssIcon from '@components/icons/local/rss';
import FolderBoldDuotoneIcon from '@components/icons/solar/folder-bold-duotone';
import { Header } from '@components/navigation/header';
import { FollowingScreen } from '@components/screens/following';
import { FilterActionButton } from '@components/screens/following/ui/filter-action.button';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { useFeeds, useUnreadCounts } from '@readspace/shared';
import { useFeedViewStore } from '@stores/feed-view';
import { useFollowingStore } from '@stores/following';
import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/lib/constants/colors';

export default function FollowingRoute() {
  const scrollY = useSharedValue(0);
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const activeTab = useFollowingStore((state) => state.activeTab);
  const previousTab = useFollowingStore((state) => state.previousTab);
  const setActiveTab = useFollowingStore((state) => state.setActiveTab);
  const filter = useFollowingStore((state) => state.filter);
  const setFilter = useFollowingStore((state) => state.setFilter);
  const insets = useSafeAreaInsets();
  const safeAreaTop = insets.top > 0 ? insets.top : Constants.statusBarHeight;
  const initialHeaderHeight = useMemo(() => {
    // foreground title (approx 44px) + tabs row (approx 52px) + top padding (10px)
    return safeAreaTop + 106;
  }, [safeAreaTop]);
  const [headerHeight, setHeaderHeight] = useState(initialHeaderHeight);
  const feedSwitcherRef = useRef<BottomSheetModal>(null);

  // Get selected feed/folder name from feed view store
  const viewType = useFeedViewStore((state) => state.viewType);
  const selectedName = useFeedViewStore((state) => state.selectedName);
  const selectedId = useFeedViewStore((state) => state.selectedId);
  const clearView = useFeedViewStore((state) => state.clearView);
  const isViewingFeedOrFolder =
    viewType === 'feed' || viewType === 'folder' || viewType === 'feedPreview';

  // Determine the header title based on view type
  const headerTitle = useMemo(() => {
    if ((viewType === 'feed' || viewType === 'folder') && selectedName) {
      return selectedName;
    }
    return 'Following';
  }, [viewType, selectedName]);

  const headerTitleIcon = useMemo(() => {
    if (viewType === 'folder') {
      return (
        <FolderBoldDuotoneIcon
          width={24}
          height={24}
          color={COLORS[isDark ? 'dark' : 'light'].primary_foreground}
        />
      );
    }
    if (viewType === 'feed' || viewType === 'feedPreview') {
      return <RssIcon width={24} height={24} color={COLORS[isDark ? 'dark' : 'light'].orange} />;
    }
    return undefined;
  }, [viewType, isDark]);

  const handleTitlePress = useCallback(() => {
    feedSwitcherRef.current?.present();
  }, []);

  const handleTabChange = useCallback(
    (index: number) => {
      if (isViewingFeedOrFolder) {
        clearView();
      }
      setActiveTab(index);
    },
    [isViewingFeedOrFolder, clearView, setActiveTab]
  );

  const { data: unreadCountsData } = useUnreadCounts();
  const { data: feedsData } = useFeeds();

  const unreadCount = useMemo(() => {
    if (!unreadCountsData) return 0;

    // 1. If we are in activeTab === 1 (Today)
    if (activeTab === 1 && !isViewingFeedOrFolder) {
      return unreadCountsData.today || 0;
    }

    // 2. If activeTab === 2 (Saved), unread count doesn't apply
    if (activeTab === 2 && !isViewingFeedOrFolder) {
      return 0;
    }

    // 3. If viewing a specific feed
    if ((viewType === 'feed' || viewType === 'feedPreview') && selectedId) {
      return unreadCountsData.feed_counts?.[selectedId] || 0;
    }

    // 4. If viewing a specific folder
    if (viewType === 'folder' && selectedId && feedsData?.subscriptions) {
      // Sum unread counts for all feeds in this folder
      const folderFeeds = (feedsData.subscriptions as any[]).filter(
        (sub) => sub.folder_id === selectedId
      );
      return folderFeeds.reduce(
        (sum, sub) => sum + (unreadCountsData.feed_counts?.[sub.id] || 0),
        0
      );
    }

    // 5. Default case: Not viewing specific feed/folder and activeTab === 0 (All)
    // Sum of all unread counts
    if (unreadCountsData.feed_counts) {
      return Object.values(unreadCountsData.feed_counts).reduce(
        (sum, count) => sum + (count || 0),
        0
      );
    }

    return 0;
  }, [unreadCountsData, feedsData, activeTab, viewType, selectedId, isViewingFeedOrFolder]);

  // Calculate safe minimum header height (safe area + title + tabs + padding)
  // This ensures content never appears under header, even if headerHeight is 0
  const safeMinimumHeight = useMemo(() => {
    const baseHeight = safeAreaTop + 10 + 80; // safe area + padding + title
    const tabsHeight = 50; // Tabbed header always renders tabs
    return baseHeight + tabsHeight;
  }, [safeAreaTop]);

  // Persist header height - only update when we get a valid (> 0) height
  // This prevents headerHeight from dropping to 0 during remeasurements
  const handleHeaderHeightChange = (height: number) => {
    if (height > 0) {
      setHeaderHeight(height);
    }
  };

  // Reset scrollY when tab changes - do this synchronously before render
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollY is a stable SharedValue reference
  useEffect(() => {
    // Reset immediately and synchronously to prevent any race conditions
    scrollY.value = 0;
  }, [activeTab]);

  // Reset scrollY when filter changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollY is a stable SharedValue reference
  useEffect(() => {
    // Reset scroll position when filter changes since list content changes
    scrollY.value = 0;
  }, [filter]);

  // Reset scrollY when feed/folder selection changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollY is a stable SharedValue reference
  useEffect(() => {
    // Reset scroll position when switching between feeds/folders or back to default view
    scrollY.value = 0;
  }, [viewType, selectedName]);

  // Create filter action button component
  const filterActionButton = useMemo(
    () => <FilterActionButton filter={filter} onFilterChange={setFilter} />,
    [filter, setFilter]
  );

  // Handle Android back button
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') {
        return;
      }

      const onBackPress = () => {
        // If viewing a feed/folder/preview, clear the view first
        if (isViewingFeedOrFolder) {
          clearView();
          return true; // Prevent default back behavior
        }

        // If not on default tab (tab 0 = "All"), switch to previous tab or default tab
        if (activeTab !== 0) {
          const targetTab = previousTab !== null ? previousTab : 0; // Default to "All" tab
          setActiveTab(targetTab);
          return true; // Prevent default back behavior
        }

        // On default tab (tab 0) with no feed/folder view
        // If there's a previous tab, switch to it; otherwise prevent exit
        if (previousTab !== null && previousTab !== 0) {
          setActiveTab(previousTab);
          return true; // Prevent default back behavior
        }

        // No previous tab to go back to - prevent app exit
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => subscription.remove();
    }, [activeTab, previousTab, isViewingFeedOrFolder, setActiveTab, clearView])
  );

  return (
    <View className="bg-background flex-1" style={{ backgroundColor: colors.background }}>
      <FollowingScreen
        activeTab={activeTab}
        scrollY={scrollY}
        headerHeight={headerHeight}
        safeMinimumHeight={safeMinimumHeight}
      />
      <Header
        variant="tabbed"
        title={headerTitle}
        titleIcon={headerTitleIcon}
        unreadCount={unreadCount}
        scrollY={scrollY}
        activeTab={isViewingFeedOrFolder ? -1 : activeTab}
        onTabChange={handleTabChange}
        onHeaderHeightChange={handleHeaderHeightChange}
        actionButton={filterActionButton}
        onTitlePress={handleTitlePress}
      />

      {/* Feed Switcher Bottom Sheet */}
      <FeedSwitcherBottomSheet ref={feedSwitcherRef} />
    </View>
  );
}
