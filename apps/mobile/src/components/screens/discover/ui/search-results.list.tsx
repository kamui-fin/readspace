import { FeedListItem } from '@components/screens/discover/ui/feed-list-item.card';
import { InfiniteScrollList } from '@components/ui/infinite-scroll-list';
import { Skeleton } from '@components/ui/skeleton';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import type { FeedSummary } from '@readspace/shared';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { CategoriesList } from './categories.list';

interface SearchResultsProps {
  showSearchSkeleton: boolean;
  hits: FeedSummary[];
  contentPaddingBottom: number;
  selectedCategory: string | null;
  categoriesRow1: string[];
  categoriesRow2: string[];
  onCategoryPress: (category: string) => void;
  onClearCategory: () => void;
  categoryScrollRef: React.RefObject<ScrollView | null>;
  searchQuery: string;
  showCategoriesList?: boolean;
}

interface SearchListItem extends Partial<FeedSummary> {
  id: string;
  isSkeleton?: boolean;
  is_preview?: boolean;
}

export function SearchResults({
  showSearchSkeleton,
  hits,
  contentPaddingBottom,
  selectedCategory,
  categoriesRow1,
  categoriesRow2,
  onCategoryPress,
  onClearCategory,
  categoryScrollRef,
  searchQuery,
  showCategoriesList = false,
}: SearchResultsProps) {
  const listRef = useRef<any>(null);
  const isDark = useIsDarkMode();
  const scrollOffsetRef = useRef(0);

  const firstHitId = hits?.[0]?.id || '';

  // We keep the list component mounted (key only changes on dark/light mode) to prevent costly
  // native list recreation and layout measurement passes. This eliminates blank flashes when
  // switching categories, loading skeletons, or displaying results.
  const listKey = useMemo(() => {
    return isDark ? 'dark' : 'light';
  }, [isDark]);

  // Combine hits and skeletons into one unified data source for InfiniteScrollList.
  // This keeps the list component mounted, preventing measurement & rendering issues.
  const listItems = useMemo<SearchListItem[]>(() => {
    if (showSearchSkeleton) {
      return Array.from({ length: 8 }, (_, i) => ({
        id: `search-skeleton-${i}`,
        isSkeleton: true,
      }));
    }
    return (hits || []).filter(Boolean);
  }, [showSearchSkeleton, hits]);

  const listItemsLength = listItems.length;

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset scroll top when category or list items change
  useEffect(() => {
    // Only reset scroll position to top if the user has actually scrolled.
    // Calling scrollToOffset(0) unconditionally when already at top triggers
    // incorrect layout calculations/measurements in LegendList during rendering.
    if (scrollOffsetRef.current > 0) {
      try {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
        scrollOffsetRef.current = 0;
      } catch {
        // Ignore if list/ref is not ready
      }
    }
  }, [selectedCategory, listItemsLength]);

  const handleScroll = useCallback((event: any) => {
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  const renderItem = useCallback((item: SearchListItem) => {
    if (item.isSkeleton) {
      return (
        <View className="flex-row items-center gap-4 py-3 px-6">
          <Skeleton variant="rectangle" width={48} height={48} className="rounded-lg" />
          <View className="flex-1 gap-2">
            <Skeleton variant="text" width="70%" height={20} />
            <Skeleton variant="text" width="100%" height={16} />
            <Skeleton variant="text" width="80%" height={16} />
          </View>
        </View>
      );
    }

    return (
      <FeedListItem
        feedId={item.id}
        title={item.title || 'Untitled Feed'}
        description={item.description || ''}
        iconUrl={item.image_url || undefined}
        isFollowing={item.is_subscribed || false}
        className="px-6"
        isPreview={item.is_preview}
      />
    );
  }, []);

  const renderEmpty = useCallback(() => {
    // If showSearchSkeleton is true, listItems will contain skeleton items, so list won't be empty.
    // If showSearchSkeleton is false and there are no hits, we show "No feeds found matching your search"
    return (
      <View className="flex-1 items-center px-6 pt-24">
        <Text size="base" fontFamily="geist" className="text-grey text-center">
          No feeds found matching your search
        </Text>
      </View>
    );
  }, []);

  return (
    <View className="flex-1">
      {showCategoriesList && (
        <View className="mb-4 mt-3">
          <CategoriesList
            selectedCategory={selectedCategory}
            categoriesRow1={categoriesRow1}
            categoriesRow2={categoriesRow2}
            onCategoryPress={onCategoryPress}
            onClearCategory={onClearCategory}
            categoryScrollRef={categoryScrollRef}
          />
        </View>
      )}
      <InfiniteScrollList
        ref={listRef}
        key={listKey}
        data={listItems}
        estimatedItemSize={80}
        drawDistance={1500}
        initialContainerPoolRatio={20}
        recycleItems={false}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: contentPaddingBottom,
        }}
      />
    </View>
  );
}
