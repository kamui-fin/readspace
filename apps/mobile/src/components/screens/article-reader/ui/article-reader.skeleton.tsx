import { Divider } from '@components/ui/divider';
import { Skeleton } from '@components/ui/skeleton';
import type { Article } from '@readspace/shared';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ArticleReaderSkeletonProps {
  article?: Article;
}

export function ArticleReaderSkeleton({ article }: ArticleReaderSkeletonProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      {/* Featured Image placeholder - Edge-to-edge */}
      {(article?.image_url || !article) && (
        <View style={{ marginTop: insets.top }}>
          <Skeleton variant="rectangle" height={200} width="100%" className="rounded-none" />
        </View>
      )}

      {/* Article Header */}
      <View
        className="mb-6 px-6 pb-6"
        style={{ marginTop: article?.image_url || !article ? 24 : insets.top + 56 }}>
        {/* Source */}
        <View className="mb-2 flex-row items-center gap-2">
          <Skeleton variant="rectangle" height={16} width={16} className="rounded-sm" />
          <Skeleton variant="text" height={12} width={128} />
        </View>

        {/* Title - show 2 lines */}
        <View className="mb-3">
          <Skeleton variant="text" height={28} width="100%" className="mb-2" />
          <Skeleton variant="text" height={28} width="75%" />
        </View>

        {/* Metadata */}
        <Skeleton variant="text" height={14} width={192} />

        {/* Divider */}
        <Divider className="mt-6" />
      </View>

      {/* Article Content - minimal paragraphs */}
      <View className="px-6">
        {/* First paragraph - 3 lines */}
        <View className="mb-4">
          <Skeleton variant="text" height={20} width="100%" className="mb-1.5" />
          <Skeleton variant="text" height={20} width="100%" className="mb-1.5" />
          <Skeleton variant="text" height={20} width="85%" />
        </View>

        {/* Second paragraph - 3 lines */}
        <View className="mb-4">
          <Skeleton variant="text" height={20} width="100%" className="mb-1.5" />
          <Skeleton variant="text" height={20} width="100%" className="mb-1.5" />
          <Skeleton variant="text" height={20} width="70%" />
        </View>
      </View>
    </View>
  );
}
