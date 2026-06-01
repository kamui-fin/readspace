import { Chip } from '@components/ui/chip';
import { Text } from '@components/ui/text';
import { stripHtml } from '@lib/utils/html';
import { Article } from '@readspace/shared';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';

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
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const processedTags = article.tags
    ? Array.from(
        new Set(
          article.tags
            .flatMap((tag) => tag.split(','))
            .map((tag) => {
              const decoded = tag
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&apos;/g, "'")
                .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
                .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
              return decoded.trim();
            })
            .filter(Boolean)
        )
      )
    : [];

  return (
    <View
      className="mx-6 mb-6 border-b pb-6"
      style={{
        marginTop: article.image_url ? 24 : insets.top + 80,
        borderBottomColor: colors.divider,
      }}>
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
            <Text size="sm" fontFamily="geist" className="text-grey uppercase tracking-wide">
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
            <Text size="sm" fontFamily="geist" className="text-grey uppercase tracking-wide">
              {displaySource || 'Unknown Source'}
            </Text>
          </View>
        )}

        {/* Article Tags */}
        {processedTags.length > 0 && (
          <View className="flex-row flex-wrap gap-2">
            {processedTags.slice(0, 5).map((tag) => (
              <Chip
                key={tag}
                label={tag.toLowerCase()}
                variant="filled"
                size="small"
                textClassName="font-geist-mono font-medium text-grey"
              />
            ))}
          </View>
        )}
      </View>

      {/* Title */}
      <Text
        size="lg"
        fontFamily="geist-bold"
        className="text-primary-foreground mb-3"
        style={{ letterSpacing: -1.2, fontSize: 30, lineHeight: 38 }}>
        {stripHtml(article.title)}
      </Text>

      {/* Note for clipped articles */}
      {isClipped && article.user_note && (
        <View className="border-grey4 bg-grey6 mb-3 rounded-lg border px-3 py-2">
          <Text size="sm" fontFamily="geist" className="text-grey leading-relaxed">
            {article.user_note}
          </Text>
        </View>
      )}

      {/* Metadata */}
      <View className="flex-row flex-wrap items-center gap-2">
        {article.author && !isClipped && (
          <>
            <Text size="sm" fontFamily="geist" className="text-grey flex-shrink" numberOfLines={1}>
              By {article.author}
            </Text>
            <Text size="sm" fontFamily="geist" className="text-grey">
              /
            </Text>
          </>
        )}
        <Text size="sm" fontFamily="geist" className="text-grey flex-shrink" numberOfLines={1}>
          {displayDate}
        </Text>
        {readTime && (
          <Text size="sm" fontFamily="geist" className="text-grey">
            /
          </Text>
        )}
        {readTime && (
          <Text size="sm" fontFamily="geist" className="text-grey flex-shrink" numberOfLines={1}>
            {readTime}
          </Text>
        )}
      </View>
    </View>
  );
}
