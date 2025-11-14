import { View } from 'react-native';
import { Skeleton } from '@components/ui/skeleton';

export function ArticleReaderSkeleton() {
  return (
    <View className="flex-1 px-6 py-6">
      {/* Header skeleton */}
      <View className="mb-6 gap-3">
        <Skeleton variant="text" height={16} width={120} />
        <Skeleton variant="text" height={32} width="100%" />
        <Skeleton variant="text" height={32} width="85%" />
        <Skeleton variant="text" height={16} width={200} />
      </View>

      {/* Content skeletons */}
      <View className="gap-4">
        <Skeleton variant="text" height={20} width="100%" />
        <Skeleton variant="text" height={20} width="100%" />
        <Skeleton variant="text" height={20} width="95%" />
        <Skeleton variant="text" height={20} width="100%" />
        <Skeleton variant="text" height={20} width="90%" />
        <View className="my-4" />
        <Skeleton variant="text" height={20} width="100%" />
        <Skeleton variant="text" height={20} width="100%" />
        <Skeleton variant="text" height={20} width="88%" />
      </View>
    </View>
  );
}
