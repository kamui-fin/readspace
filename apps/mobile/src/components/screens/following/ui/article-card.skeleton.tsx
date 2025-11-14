import { View } from 'react-native';
import { Skeleton } from '@components/ui/skeleton';
import { Divider } from '@components/ui/divider';

interface ArticleCardSkeletonProps {
  showTopDivider?: boolean;
  showBottomDivider?: boolean;
}

export function ArticleCardSkeleton({
  showTopDivider = false,
  showBottomDivider = true,
}: ArticleCardSkeletonProps) {
  return (
    <View>
      {showTopDivider && <Divider />}
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
      {showBottomDivider && <Divider />}
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
        <ArticleCardSkeleton
          key={`article-card-skeleton-${index + 1}`}
          showTopDivider={index > 0}
          showBottomDivider={index < count - 1}
        />
      ))}
    </View>
  );
}
