import { View, ScrollView } from 'react-native';
import { Skeleton } from '@components/ui/skeleton';
import { Divider } from '@components/ui/divider';
import type { Article } from '@readspace/shared';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ArticleReaderSkeletonProps {
  article?: Article;
}

export function ArticleReaderSkeleton({ article }: ArticleReaderSkeletonProps) {
  const insets = useSafeAreaInsets();

  // Calculate minimal offset to clear action bar buttons
  // Action bar: safe area top + button height + small buffer
  const actionBarOffset = insets.top + 8;

  // Estimate content structure from article HTML
  const contentStructure = useMemo(() => {
    if (!article?.content) {
      // Default structure if no article data
      return { paragraphs: 3, linesPerParagraph: [4, 3, 4] };
    }

    // Count paragraphs and estimate lines
    const content = article.content;
    const paragraphCount = (content.match(/<p>/gi) || []).length || 3;
    const hasImages = (content.match(/<img/gi) || []).length > 1;
    const hasLists = (content.match(/<ul>|<ol>/gi) || []).length > 0;

    // Generate realistic line counts per paragraph (3-5 lines each)
    const linesPerParagraph = Array.from(
      { length: Math.min(paragraphCount, 5) },
      () => Math.floor(Math.random() * 3) + 3
    );

    return {
      paragraphs: Math.min(paragraphCount, 5),
      linesPerParagraph,
      hasImages,
      hasLists,
    };
  }, [article?.content]);

  // Generate stable paragraph data with unique keys
  const paragraphData = useMemo(
    () =>
      Array.from({ length: contentStructure.paragraphs }, (_, i) => ({
        id: `para-${i}-${Date.now()}`,
        lines: Array.from({ length: contentStructure.linesPerParagraph[i] || 4 }, (__, j) => ({
          id: `line-${i}-${j}-${Date.now()}`,
          width:
            j === (contentStructure.linesPerParagraph[i] || 4) - 1
              ? `${Math.floor(Math.random() * 30) + 60}%`
              : '100%',
        })),
      })),
    [contentStructure.paragraphs, contentStructure.linesPerParagraph]
  );

  // Generate stable post-image paragraph data
  const postImageParagraphData = useMemo(
    () =>
      Array.from({ length: 2 }, (_, i) => ({
        id: `post-img-para-${i}-${Date.now()}`,
        lines: Array.from({ length: 4 }, (__, j) => ({
          id: `post-img-line-${i}-${j}-${Date.now()}`,
          width: j === 3 ? '75%' : '100%',
        })),
      })),
    []
  );

  return (
    <ScrollView
      className="flex-1 bg-background dark:bg-background-dark"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: actionBarOffset,
        paddingBottom: 80,
      }}>
      {/* Featured Image placeholder - show if article has image OR if article is loading */}
      {(article?.image_url || !article) && (
        <Skeleton variant="rectangle" height={240} width="100%" className="rounded-none" />
      )}

      {/* Article Header */}
      <View
        className="mx-6 mb-6 pb-6"
        style={{ marginTop: article?.image_url || !article ? 24 : 0 }}>
        {/* Source */}
        <View className="mb-2 flex-row items-center gap-2">
          <Skeleton variant="rectangle" height={16} width={16} className="rounded-sm" />
          <Skeleton variant="text" height={12} width={128} />
        </View>

        {/* Title - show 2 lines by default when loading or if title is long */}
        <View className="mb-3">
          <Skeleton variant="text" height={28} width="100%" className="mb-2" />
          {(!article || (article?.title && article.title.length > 50)) && (
            <Skeleton variant="text" height={28} width="80%" />
          )}
        </View>

        {/* Metadata */}
        <Skeleton variant="text" height={14} width={192} />

        {/* Divider */}
        <Divider className="mt-6" />
      </View>

      {/* Article Content - based on actual structure */}
      <View className="px-6 pb-20">
        {paragraphData.map((paragraph) => (
          <View key={paragraph.id} className="mb-5">
            {paragraph.lines.map((line) => (
              <Skeleton
                key={line.id}
                variant="text"
                height={20}
                width={line.width}
                className="mb-1.5"
              />
            ))}
          </View>
        ))}

        {/* Add image placeholder if content has images */}
        {contentStructure.hasImages && (
          <View className="mb-5">
            <Skeleton variant="rectangle" height={200} width="100%" className="rounded-xl" />
          </View>
        )}

        {/* Add more paragraphs after image */}
        {contentStructure.hasImages &&
          postImageParagraphData.map((paragraph) => (
            <View key={paragraph.id} className="mb-5">
              {paragraph.lines.map((line) => (
                <Skeleton
                  key={line.id}
                  variant="text"
                  height={20}
                  width={line.width}
                  className="mb-1.5"
                />
              ))}
            </View>
          ))}
      </View>
    </ScrollView>
  );
}
