import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

import { Header } from '@components/navigation/header';
import { FollowingScreen } from '@components/screens/following';
import { useFollowingStore } from '@stores/following';
import { useFeedViewStore } from '@stores/feed-view';
import { FilterActionButton } from '@/components/screens/following/ui/filter-action.button';
import { FeedSwitcherBottomSheet } from '@/components/bottom-sheets/feed-switcher';

export default function FollowingRoute() {
  const scrollY = useSharedValue(0);
  const activeTab = useFollowingStore((state) => state.activeTab);
  const setActiveTab = useFollowingStore((state) => state.setActiveTab);
  const filter = useFollowingStore((state) => state.filter);
  const setFilter = useFollowingStore((state) => state.setFilter);
  const [headerHeight, setHeaderHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const feedSwitcherRef = useRef<BottomSheetModal>(null);

  // Get selected feed/folder name from feed view store
  const viewType = useFeedViewStore((state) => state.viewType);
  const selectedName = useFeedViewStore((state) => state.selectedName);

  // Determine the header title based on view type
  const headerTitle = useMemo(() => {
    if ((viewType === 'feed' || viewType === 'folder') && selectedName) {
      return selectedName;
    }
    return 'Following';
  }, [viewType, selectedName]);

  const handleTitlePress = useCallback(() => {
    feedSwitcherRef.current?.present();
  }, []);

  // Calculate safe minimum header height (safe area + title + tabs + padding)
  // This ensures content never appears under header, even if headerHeight is 0
  const safeMinimumHeight = insets.top + 10 + 80 + 50 + 16; // ~156px + safe area

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

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <Header
        variant="tabbed"
        title={headerTitle}
        scrollY={scrollY}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onHeaderHeightChange={handleHeaderHeightChange}
        actionButton={filterActionButton}
        onTitlePress={handleTitlePress}
      />
      <FollowingScreen
        activeTab={activeTab}
        scrollY={scrollY}
        headerHeight={headerHeight}
        safeMinimumHeight={safeMinimumHeight}
      />

      {/* Feed Switcher Bottom Sheet */}
      <FeedSwitcherBottomSheet ref={feedSwitcherRef} />
    </View>
  );
}
