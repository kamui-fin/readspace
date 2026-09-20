import { FeedListItem } from '@components/screens/discover/ui/feed-list-item.card';
import { InfiniteScrollList } from '@components/ui/infinite-scroll-list';
import { Skeleton } from '@components/ui/skeleton';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import type { FeedSummary } from '@readspace/shared';
import { type ReactElement, type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';

interface SearchResultsProps {
  hits: FeedSummary[];
  /** Placeholder rows for an in-flight search whose answer isn't on screen yet. */
  showSkeletons: boolean;
  isError: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  contentPaddingBottom: number;
  /** Filter chrome; scrolls away with the results rather than pinning. */
  listHeader?: ReactElement | null;
  /** Identifies the current search — changing it scrolls the list back to the top. */
  resetKey: string;
  /** Optional CTA rendered under the empty state (e.g. "Try Smart search"). */
  emptyAction?: ReactNode;
  emptyHint?: string;
}

interface SearchListItem extends Partial<FeedSummary> {
  id: string;
  isSkeleton?: boolean;
  is_preview?: boolean;
}

const SKELETON_COUNT = 8;

function FeedRowSkeleton() {
  return (
    <View className="flex-row items-center gap-4 px-6 py-3">
      <Skeleton variant="rectangle" width={48} height={48} className="rounded-lg" />
      <View className="flex-1 gap-2">
        <Skeleton variant="text" width="70%" height={20} />
        <Skeleton variant="text" width="100%" height={16} />
        <Skeleton variant="text" width="80%" height={16} />
      </View>
    </View>
  );
}

/**
 * Feed results list for search and category browsing.
 *
 * Skeletons are injected as list *data* rather than swapped in as a separate
 * component so the underlying LegendList never unmounts between states — a
 * remount forces a fresh layout measurement pass and shows up as a blank frame.
 */
export function SearchResults({
  hits,
  showSkeletons,
  isError,
  hasMore,
  onLoadMore,
  contentPaddingBottom,
  listHeader,
  resetKey,
  emptyAction,
  emptyHint,
}: SearchResultsProps) {
  const listRef = useRef<any>(null);
  const isDark = useIsDarkMode();
  const scrollOffsetRef = useRef(0);

  const listItems = useMemo<SearchListItem[]>(() => {
    if (showSkeletons) {
      return Array.from({ length: SKELETON_COUNT }, (_, index) => ({
        id: `search-skeleton-${index}`,
        isSkeleton: true,
      }));
    }
    return (hits || []).filter(Boolean);
  }, [showSkeletons, hits]);

  useEffect(() => {
    // Only scroll if the user actually moved: calling scrollToOffset(0) while
    // already at the top makes LegendList re-measure mid-render and flicker.
    if (scrollOffsetRef.current > 0) {
      try {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
        scrollOffsetRef.current = 0;
      } catch {
        // Ignore if the list ref isn't ready yet.
      }
    }
  }, [resetKey]);

  const handleScroll = useCallback((event: any) => {
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  const renderFooter = useCallback(() => {
    if (!hasMore || showSkeletons) return null;
    return (
      <View className="pt-1">
        {Array.from({ length: 3 }, (_, index) => (
          <FeedRowSkeleton key={`search-footer-skeleton-${index}`} />
        ))}
      </View>
    );
  }, [hasMore, showSkeletons]);

  const renderItem = useCallback((item: SearchListItem) => {
    if (item.isSkeleton) return <FeedRowSkeleton />;

    return (
      <FeedListItem
        feedId={item.id}
        title={item.title || 'Untitled Feed'}
        description={item.description || ''}
        iconUrl={item.image_url || undefined}
        isFollowing={item.is_subscribed || false}
        feedUrl={item.url || undefined}
        className="px-6"
        isPreview={item.is_preview}
        showFollowButton={false}
      />
    );
  }, []);

  const renderEmpty = useCallback(() => {
    if (isError) {
      return (
        <View className="items-center px-10 pt-20">
          <Text size="base" fontFamily="geist-semibold" className="text-black text-center">
            Search is unavailable
          </Text>
          <Text size="sm" fontFamily="geist" className="text-grey mt-2 text-center">
            Check your connection and try again.
          </Text>
        </View>
      );
    }

    return (
      <View className="items-center px-10 pt-20">
        <Text size="base" fontFamily="geist-semibold" className="text-black text-center">
          No feeds found
        </Text>
        <Text size="sm" fontFamily="geist" className="text-grey mt-2 text-center">
          {emptyHint ?? 'Try a different wording, or browse by category.'}
        </Text>
        {emptyAction && <View className="mt-5">{emptyAction}</View>}
      </View>
    );
  }, [isError, emptyAction, emptyHint]);

  return (
    <InfiniteScrollList
      ref={listRef}
      // Keyed only on theme: any other key change remounts the native list.
      key={isDark ? 'dark' : 'light'}
      data={listItems}
      estimatedItemSize={80}
      drawDistance={1500}
      initialContainerPoolRatio={20}
      recycleItems={false}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={listHeader ?? undefined}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={renderFooter}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      hasMore={hasMore}
      onEndReached={onLoadMore}
      contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
    />
  );
}
