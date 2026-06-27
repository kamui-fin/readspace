import { FeedListItem } from '@components/screens/discover/ui/feed-list-item.card';
import { Skeleton } from '@components/ui/skeleton';
import { Text } from '@components/ui/text';
import { memo, useCallback } from 'react';
import { View } from 'react-native';

type TrendingFeedItem = {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  url: string | null;
  is_subscribed?: boolean;
};

interface TrendingSectionProps {
  showTrendingSkeleton: boolean;
  trendingError: Error | null;
  trendingData: TrendingFeedItem[] | undefined;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
}

const SkeletonRow = ({ id }: { id: string }) => (
  <View key={id} className="flex-row gap-3 py-1">
    <Skeleton variant="circle" width={48} height={48} />
    <View className="flex-1 justify-center gap-2">
      <Skeleton variant="text" width="70%" height={18} />
      <Skeleton variant="text" width="90%" height={14} />
    </View>
  </View>
);

export const TrendingSection = memo(
  ({
    showTrendingSkeleton,
    trendingError,
    trendingData,
    hasNextPage = false,
    isFetchingNextPage = false,
  }: TrendingSectionProps) => {
    const header = (
      <View className="mb-4 mt-8">
        <Text size="base" fontFamily="geist-semibold" className="text-black">
          Trending
        </Text>
      </View>
    );

    if (showTrendingSkeleton) {
      return (
        <View className="px-6">
          {header}
          <View className="gap-3">
            {Array.from({ length: 5 }, (_, i) => (
              <SkeletonRow key={`trending-skeleton-${i}`} id={`trending-skeleton-${i}`} />
            ))}
          </View>
        </View>
      );
    }

    if (trendingError) {
      return (
        <View className="px-6">
          {header}
          <Text size="base" fontFamily="geist" className="text-grey text-center">
            Error loading trending feeds
          </Text>
        </View>
      );
    }

    if (!trendingData || trendingData.length === 0) {
      return (
        <View className="px-6">
          {header}
          <Text size="base" fontFamily="geist" className="text-grey text-center">
            No trending feeds available
          </Text>
        </View>
      );
    }

    return (
      <View className="px-6">
        {header}
        <View className="gap-1">
          {trendingData.map((feed) => (
            <FeedListItem
              key={feed.id}
              feedId={feed.id}
              title={feed.title || 'Untitled Feed'}
              description={feed.description || ''}
              iconUrl={feed.image_url || undefined}
              feedUrl={feed.url || undefined}
              isFollowing={feed.is_subscribed || false}
            />
          ))}
        </View>
        {isFetchingNextPage && (
          <View className="gap-3 pt-3">
            {Array.from({ length: 3 }, (_, i) => (
              <SkeletonRow
                key={`trending-footer-skeleton-${i}`}
                id={`trending-footer-skeleton-${i}`}
              />
            ))}
          </View>
        )}
        {!hasNextPage && trendingData.length > 0 && (
          <View className="items-center py-4">
            <Text size="sm" fontFamily="geist" className="text-grey">
              That's all for now
            </Text>
          </View>
        )}
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.showTrendingSkeleton === nextProps.showTrendingSkeleton &&
      prevProps.trendingError === nextProps.trendingError &&
      prevProps.trendingData === nextProps.trendingData &&
      prevProps.hasNextPage === nextProps.hasNextPage &&
      prevProps.isFetchingNextPage === nextProps.isFetchingNextPage
    );
  }
);

TrendingSection.displayName = 'TrendingSection';
