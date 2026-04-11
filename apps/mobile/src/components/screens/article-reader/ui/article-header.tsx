import { Chip } from '@components/ui/chip';
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
      className="mb-6 mx-6 border-b border-divider pb-6"
      style={{ marginTop: article.image_url ? 24 : insets.top + 80 }}>
      {/* Source & Tags */}
      <View className="mb-2 gap-2">
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
              className="uppercase tracking-wide text-grey">
              {displaySource || 'Unknown Source'}
            </Text>
          </Pressable>
        ) : (
          <View className="flex-row items-center gap-2">
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
              className="uppercase tracking-wide text-grey">
              {displaySource || 'Unknown Source'}
            </Text>
          </View>
        )}

        {/* Article Tags */}
        {article.tags && article.tags.length > 0 && (
          <View className="flex-row flex-wrap gap-2">
            {article.tags.slice(0, 5).map((tag) => (
              <Chip key={tag} label={tag.toLowerCase()} variant="filled" size="small" textClassName="font-geist-mono font-medium text-grey" />
            ))}
          </View>
        )}
      </View>

      {/* Title */}
      <Text
        size="lg"
        fontFamily="geist-bold"
        className="mb-3 text-primary-foreground dark:text-primary-foreground-dark"
        style={{ letterSpacing: -1.2, fontSize: 30, lineHeight: 38 }}>
        {stripHtml(article.title)}
      </Text>

      {/* Note for clipped articles */}
      {isClipped && article.user_note && (
        <View className="mb-3 rounded-lg border border-grey4 bg-grey6 px-3 py-2">
          <Text
            size="sm"
            fontFamily="geist"
            className="leading-relaxed text-grey">
            {article.user_note}
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
              className="flex-shrink text-grey"
              numberOfLines={1}>
              By {article.author}
            </Text>
            <Text size="sm" fontFamily="geist" className="text-grey">
              /
            </Text>
          </>
        )}
        <Text
          size="sm"
          fontFamily="geist"
          className="flex-shrink text-grey"
          numberOfLines={1}>
          {displayDate}
        </Text>
        {readTime && (
          <Text size="sm" fontFamily="geist" className="text-grey">
            /
          </Text>
        )}
        {readTime && (
          <Text
            size="sm"
            fontFamily="geist"
            className="flex-shrink text-grey"
            numberOfLines={1}>
            {readTime}
          </Text>
        )}
      </View>
    </View>
  );
}
