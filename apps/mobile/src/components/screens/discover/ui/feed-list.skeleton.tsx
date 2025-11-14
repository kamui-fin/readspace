import { View } from 'react-native';
import { Skeleton } from '@components/ui/skeleton';
import { useMemo } from 'react';

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
        <View key={key} className="flex-row items-center gap-4">
          {/* Icon skeleton */}
          <Skeleton className="h-12 w-12 rounded-lg" />

          {/* Content skeleton */}
          <View className="flex-1 gap-2">
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-2/3 rounded" />
          </View>

          {/* Button skeleton */}
          <Skeleton className="h-8 w-20 rounded-full" />
        </View>
      ))}
    </View>
  );
}
