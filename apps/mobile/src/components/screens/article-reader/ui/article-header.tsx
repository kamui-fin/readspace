import { Text } from '@components/ui/text';
import { stripHtml } from '@lib/utils/html';
import { Article } from '@readspace/shared';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ArticleHeaderProps {
  article: Article;
  isClipped: boolean;
  feedId?: string;
  displayFaviconUrl?: string;
  fallbackComponent: React.FC<{ size?: number; className?: string }>;
  displaySource: string;
  displayDate: string;
  readTime: string;
}

export function ArticleHeader({
  article,
  isClipped,
  feedId,
  displayFaviconUrl,
  fallbackComponent,
  displaySource,
  displayDate,
  readTime,
}: ArticleHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="mb-6 border-b border-grey4 px-6 pb-6 dark:border-grey4-dark"
      style={{ marginTop: article.image_url ? 24 : insets.top + 56 }}>
      {/* Source */}
      {!isClipped && feedId ? (
        <Pressable
          onPress={() => {
            // Store current article ID in the navigation params so feed can navigate back correctly
            router.push({
              pathname: `/(protected)/(tabs)/discover/feed/${feedId}` as any,
              params: { returnTo: `/(protected)/articles/${article.id}` },
            });
          }}
          style={{
            marginBottom: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 4,
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          {displayFaviconUrl && (
            <ExpoImage
              source={{ uri: displayFaviconUrl }}
              style={{ width: 16, height: 16, borderRadius: 2 }}
              contentFit="contain"
            />
          )}
          <Text
            size="sm"
            fontFamily="geist"
            className="uppercase tracking-wide text-grey dark:text-grey-dark">
            {displaySource || 'Unknown Source'}
          </Text>
        </Pressable>
      ) : (
        <View className="mb-2 flex-row items-center gap-2">
          {displayFaviconUrl && (
            <ExpoImage
              source={{ uri: displayFaviconUrl }}
              style={{ width: 16, height: 16, borderRadius: 2 }}
              contentFit="contain"
            />
          )}
          <Text
            size="sm"
            fontFamily="geist"
            className="uppercase tracking-wide text-grey dark:text-grey-dark">
            {displaySource || 'Unknown Source'}
          </Text>
        </View>
      )}

      {/* Title */}
      <Text
        size="lg"
        fontFamily="geist-bold"
        className="mb-3 text-primary-foreground dark:text-primary-foreground-dark"
        style={{ letterSpacing: -0.72, fontSize: 30, lineHeight: 38 }}>
        {stripHtml(article.title)}
      </Text>

      {/* Note for clipped articles */}
      {isClipped && article.note && (
        <View className="mb-3 rounded-lg border border-grey4 bg-grey6 px-3 py-2 dark:border-grey4-dark dark:bg-grey6-dark">
          <Text
            size="sm"
            fontFamily="geist"
            className="leading-relaxed text-grey dark:text-grey-dark">
            {article.note}
          </Text>
        </View>
      )}

      {/* Metadata */}
      <View className="flex-row flex-wrap items-center gap-2">
        {article.author && !isClipped && (
          <>
            <Text
              size="sm"
              fontFamily="geist"
              className="flex-shrink text-grey dark:text-grey-dark"
              numberOfLines={1}>
              By {article.author}
            </Text>
            <Text size="sm" fontFamily="geist" className="text-grey dark:text-grey-dark">
              /
            </Text>
          </>
        )}
        <Text
          size="sm"
          fontFamily="geist"
          className="flex-shrink text-grey dark:text-grey-dark"
          numberOfLines={1}>
          {displayDate}
        </Text>
        {readTime && (
          <Text size="sm" fontFamily="geist" className="text-grey dark:text-grey-dark">
            /
          </Text>
        )}
        {readTime && (
          <Text
            size="sm"
            fontFamily="geist"
            className="flex-shrink text-grey dark:text-grey-dark"
            numberOfLines={1}>
            {readTime}
          </Text>
        )}
      </View>
    </View>
  );
}
