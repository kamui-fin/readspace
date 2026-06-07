import { Skeleton } from '@components/ui/skeleton';
import { useMemo } from 'react';
import { View } from 'react-native';

interface FeedListSkeletonProps {
  count?: number;
}

export function FeedListSkeleton({ count = 5 }: FeedListSkeletonProps) {
  // Generate stable keys for skeleton items
  const skeletonKeys = useMemo(
    () => Array.from({ length: count }, (_, i) => `feed-skeleton-${i}`),
    [count]
  );

  return (
    <View className="gap-4">
      {skeletonKeys.map((key) => (
        <View key={key} className="flex-row items-center gap-4 py-1">
          {/* Icon skeleton */}
          <Skeleton variant="rectangle" width={48} height={48} className="rounded-lg" />

          {/* Content skeleton */}
          <View className="flex-1 gap-1.5">
            <Skeleton variant="text" width="75%" height={16} className="rounded" />
            <Skeleton variant="text" width="100%" height={12} className="rounded" />
            <Skeleton variant="text" width="66%" height={12} className="rounded" />
          </View>

          {/* Button skeleton */}
          <Skeleton variant="rectangle" width={80} height={32} className="rounded-full" />
        </View>
      ))}
    </View>
  );
}
