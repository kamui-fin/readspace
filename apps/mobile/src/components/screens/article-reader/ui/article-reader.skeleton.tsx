import {
  FEATURED_IMAGE_HEIGHT,
  FEATURED_IMAGE_TOP_OFFSET,
} from '@components/screens/article-reader/ui/article-featured-image';
import { Divider } from '@components/ui/divider';
import { Skeleton } from '@components/ui/skeleton';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ArticleReaderSkeletonProps {
  /**
   * Whatever is already known about the article. Deliberately not `Article`: while the detail
   * query is still in flight there is no `Article` yet, and the only thing the skeleton needs is
   * the hero's presence — which the list row the reader was opened from already carries.
   */
  article?: { image_url?: string | null } | null;
}

export function ArticleReaderSkeleton({ article }: ArticleReaderSkeletonProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-background flex-1"
      style={{ paddingTop: insets.top + FEATURED_IMAGE_TOP_OFFSET }}>
      {/* Featured Image placeholder — height and top offset mirror ArticleFeaturedImage exactly,
          so the real image doesn't jump into place when it swaps in. */}
      {article?.image_url && (
        <View>
          <Skeleton
            variant="rectangle"
            height={FEATURED_IMAGE_HEIGHT}
            width="100%"
            className="rounded-none"
          />
        </View>
      )}

      {/* Article Header */}
      <View className="mb-6 px-6 pb-6 pt-6">
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
