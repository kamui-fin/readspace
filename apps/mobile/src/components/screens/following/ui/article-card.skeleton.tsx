import { Divider } from '@components/ui/divider';
import { Skeleton } from '@components/ui/skeleton';
import { View } from 'react-native';

export function ArticleCardSkeleton() {
  return (
    <View className="flex-row gap-3 px-4 py-4">
      {/* Content on left */}
      <View className="flex-1">
        {/* Feed name and timestamp header */}
        <View className="mb-2 flex-row items-center gap-2">
          {/* Favicon skeleton */}
          <Skeleton variant="rectangle" width={16} height={16} className="rounded-sm" />
          {/* Feed name skeleton */}
          <Skeleton variant="text" size="small" width={80} />
          {/* Clock icon and timestamp skeleton */}
          <Skeleton variant="text" size="small" width={60} />
        </View>

        {/* Title - 3 lines */}
        <View className="mb-2 gap-1">
          <Skeleton variant="text" height={20} width="100%" />
          <Skeleton variant="text" height={20} width="90%" />
          <Skeleton variant="text" height={20} width="75%" />
        </View>

        {/* Description - 2 lines */}
        <View className="gap-1">
          <Skeleton variant="text" height={16} width="100%" />
          <Skeleton variant="text" height={16} width="85%" />
        </View>
      </View>

      {/* Thumbnail on right */}
      <Skeleton variant="rectangle" width={96} height={96} className="rounded-xl" />
    </View>
  );
}

interface ArticleCardSkeletonListProps {
  count?: number;
}

export function ArticleCardSkeletonList({ count = 8 }: ArticleCardSkeletonListProps) {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <View key={`article-card-skeleton-container-${index + 1}`}>
          <ArticleCardSkeleton />
          {index < count - 1 && <Divider className="mx-4" />}
        </View>
      ))}
    </View>
  );
}
