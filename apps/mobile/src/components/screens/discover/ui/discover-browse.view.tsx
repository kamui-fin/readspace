import { CategoriesList } from '@components/screens/discover/ui/categories.list';
import { TrendingSection } from '@components/screens/discover/ui/trending-section.list';
import type { FeedSummary } from '@readspace/shared';
import { useCallback } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, View } from 'react-native';

interface DiscoverBrowseViewProps {
  categories: string[];
  onCategoryPress: (category: string) => void;
  trendingFeeds: FeedSummary[];
  trendingError: Error | null;
  showTrendingSkeleton: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMoreTrending: () => void;
  contentPaddingBottom: number;
}

const LOAD_MORE_THRESHOLD = 200;

/**
 * The Discover landing screen: category chips over a trending feed list.
 */
export function DiscoverBrowseView({
  categories,
  onCategoryPress,
  trendingFeeds,
  trendingError,
  showTrendingSkeleton,
  hasNextPage,
  isFetchingNextPage,
  onLoadMoreTrending,
  contentPaddingBottom,
}: DiscoverBrowseViewProps) {
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!hasNextPage || isFetchingNextPage) return;
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const isNearBottom =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - LOAD_MORE_THRESHOLD;
      if (isNearBottom) onLoadMoreTrending();
    },
    [hasNextPage, isFetchingNextPage, onLoadMoreTrending]
  );

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      className="flex-1"
      // iOS draws the large-title header and its search field OVER the screen; `automatic` is
      // what makes UIKit inset this scroll view below them instead of starting at y=0.
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="always"
      onScroll={handleScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingBottom: contentPaddingBottom }}>
      <View className="mb-2">
        <CategoriesList categories={categories} onCategoryPress={onCategoryPress} />
      </View>

      <TrendingSection
        showTrendingSkeleton={showTrendingSkeleton}
        trendingError={trendingError}
        trendingData={trendingFeeds}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
      />
    </ScrollView>
  );
}
