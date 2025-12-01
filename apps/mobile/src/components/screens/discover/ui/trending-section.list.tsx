import { FeedListItem } from '@components/screens/discover/ui/feed-list-item.card';
import { Skeleton } from '@components/ui/skeleton';
import { Text } from '@components/ui/text';
import { memo } from 'react';
import { View } from 'react-native';

interface TrendingSectionProps {
  showTrendingSkeleton: boolean;
  trendingError: Error | null;
  trendingData:
    | Array<{
        id: string;
        title: string | null;
        description: string | null;
        image_url: string | null;
        url: string | null;
        is_subscribed?: boolean;
        is_preview?: boolean;
      }>
    | undefined;
}

export const TrendingSection = memo(
  ({ showTrendingSkeleton, trendingError, trendingData }: TrendingSectionProps) => {
    return (
      <>
        <View className="mb-4 mt-8 px-6">
          <Text size="base" fontFamily="geist-semibold" className="text-black">
            Trending
          </Text>
        </View>

        {showTrendingSkeleton ? (
          <View className="gap-4 px-6">
            {Array.from({ length: 5 }, (_, i) => `trending-skeleton-${i}`).map((key) => (
              <View key={key} className="flex-row gap-3">
                <Skeleton variant="circle" width={48} height={48} />
                <View className="flex-1 gap-2">
                  <Skeleton variant="text" width="70%" height={20} />
                  <Skeleton variant="text" width="100%" height={16} />
                  <Skeleton variant="text" width="80%" height={16} />
                </View>
              </View>
            ))}
          </View>
        ) : trendingError ? (
          <View className="items-center justify-center px-6 py-12">
            <Text size="base" fontFamily="geist" className="mb-2 text-center text-red">
              Error loading trending feeds
            </Text>
            <Text size="sm" fontFamily="geist" className="text-center text-grey">
              {trendingError.message}
            </Text>
          </View>
        ) : trendingData && trendingData.length > 0 ? (
          <View className="px-6 pb-2">
            {trendingData.map((feed) => (
              <FeedListItem
                key={feed.id}
                feedId={feed.id}
                title={feed.title || 'Untitled Feed'}
                description={feed.description || ''}
                iconUrl={feed.image_url || undefined}
                feedUrl={feed.url || undefined}
                isFollowing={feed.is_subscribed || false}
                isPreview={feed.is_preview || false}
              />
            ))}
          </View>
        ) : (
          <View className="items-center justify-center px-6 py-12">
            <Text size="base" fontFamily="geist" className="text-center text-grey">
              No trending feeds available
            </Text>
          </View>
        )}
      </>
    );
  },
  // Custom comparison to prevent re-renders when props haven't actually changed
  (prevProps, nextProps) => {
    return (
      prevProps.showTrendingSkeleton === nextProps.showTrendingSkeleton &&
      prevProps.trendingError === nextProps.trendingError &&
      prevProps.trendingData === nextProps.trendingData
    );
  }
);

TrendingSection.displayName = 'TrendingSection';
