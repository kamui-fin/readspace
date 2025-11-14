import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import RenderHTML from 'react-native-render-html';
import Constants from 'expo-constants';
import { Galeria } from '@nandorojo/galeria';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { stripHtml } from '@lib/utils/html';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import type { Article } from '@readspace/shared';
import { calculateReadingTime } from '@readspace/shared';

export interface ArticleReaderProps {
  article: Article;
  scrollY: SharedValue<number>;
  lastScrollY: SharedValue<number>;
  scrollDirection: SharedValue<'up' | 'down'>;
}

export function ArticleReader({
  article,
  scrollY,
  lastScrollY,
  scrollDirection,
}: ArticleReaderProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  // Calculate minimal offset to clear action bar buttons
  // Action bar: safe area top + 12px top padding + 40px button height + 12px bottom padding
  // We only need to offset enough to clear the buttons, so: safe area + button height + small buffer
  const actionBarOffset = insets.top + 8; // insets.top + 8px (button height + small buffer)

  // Handle scroll events to track position and direction
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const previousScrollY = lastScrollY.value;

    // Update scroll position
    scrollY.value = currentScrollY;

    // Determine scroll direction
    // Use a threshold to prevent jitter from small movements
    const scrollThreshold = 5;
    if (currentScrollY > previousScrollY + scrollThreshold) {
      scrollDirection.value = 'down';
    } else if (currentScrollY < previousScrollY - scrollThreshold) {
      scrollDirection.value = 'up';
    }

    // Update last scroll position
    lastScrollY.value = currentScrollY;
  };

  // Dynamic colors for dark mode
  const textColor = colors.primary_foreground;
  const greyColor = colors.grey;
  const bgColor = colors.background;
  const lightGreyColor = colors.grey6;
  const midGreyColor = colors.grey5;

  // Check if this is a clipped article
  const isClipped = article.article_type === 'clipped';

  /**
   * Extract domain from URL for display
   */
  const extractDomain = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  // Configure HTML rendering with beautiful typography (EB Garamond for body text)
  const tagsStyles = useMemo(
    () => ({
      // Base body styles
      body: {
        fontFamily: 'EBGaramond_400Regular',
        fontSize: 18,
        lineHeight: 30,
        color: textColor,
      },
      // Paragraph styles
      p: {
        marginBottom: 20,
        fontFamily: 'EBGaramond_400Regular',
        fontSize: 18,
        lineHeight: 30,
        color: textColor,
      },
      // Heading hierarchy with proper spacing and typography
      h1: {
        fontFamily: 'EBGaramond_700Bold',
        fontSize: 32,
        lineHeight: 40,
        color: textColor,
        marginTop: 32,
        marginBottom: 16,
      },
      h2: {
        fontFamily: 'EBGaramond_700Bold',
        fontSize: 28,
        lineHeight: 36,
        color: textColor,
        marginTop: 28,
        marginBottom: 14,
      },
      h3: {
        fontFamily: 'EBGaramond_600SemiBold',
        fontSize: 24,
        lineHeight: 32,
        color: textColor,
        marginTop: 24,
        marginBottom: 12,
      },
      h4: {
        fontFamily: 'EBGaramond_600SemiBold',
        fontSize: 20,
        lineHeight: 28,
        color: textColor,
        marginTop: 20,
        marginBottom: 10,
      },
      h5: {
        fontFamily: 'EBGaramond_600SemiBold',
        fontSize: 18,
        lineHeight: 26,
        color: textColor,
        marginTop: 18,
        marginBottom: 8,
      },
      h6: {
        fontFamily: 'EBGaramond_600SemiBold',
        fontSize: 16,
        lineHeight: 24,
        color: textColor,
        marginTop: 16,
        marginBottom: 8,
      },
      // Inline text formatting
      strong: {
        fontFamily: 'EBGaramond_700Bold',
        color: textColor,
      },
      b: {
        fontFamily: 'EBGaramond_700Bold',
        color: textColor,
      },
      em: {
        fontFamily: 'EBGaramond_400Regular',
        fontStyle: 'italic' as const,
      },
      i: {
        fontFamily: 'EBGaramond_400Regular',
        fontStyle: 'italic' as const,
      },
      u: {
        textDecorationLine: 'underline' as const,
      },
      s: {
        textDecorationLine: 'line-through' as const,
        color: greyColor,
      },
      mark: {
        backgroundColor: colors.muted_green,
        color: textColor,
      },
      // Links with brand secondary color
      a: {
        color: colors.secondary,
        textDecorationLine: 'underline' as const,
        fontFamily: 'EBGaramond_500Medium',
      },
      // Code elements with monospace font
      code: {
        fontFamily: 'GeistMono_400Regular',
        fontSize: 16,
        lineHeight: 24,
        backgroundColor: midGreyColor,
        color: colors.primary,
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
      },
      // Pre-formatted code blocks
      pre: {
        fontFamily: 'GeistMono_400Regular',
        fontSize: 14,
        lineHeight: 22,
        backgroundColor: midGreyColor,
        color: textColor,
        padding: 16,
        borderRadius: 8,
        marginTop: 16,
        marginBottom: 20,
      },
      // Blockquotes with left border and muted styling
      blockquote: {
        fontFamily: 'EBGaramond_400Regular',
        fontSize: 18,
        lineHeight: 30,
        color: textColor,
        fontStyle: 'italic' as const,
        borderLeftWidth: 4,
        borderLeftColor: colors.secondary,
        backgroundColor: lightGreyColor,
        padding: 16,
        marginTop: 20,
        marginBottom: 20,
        marginLeft: 0,
        marginRight: 0,
      },
      // Horizontal rule
      hr: {
        backgroundColor: lightGreyColor,
        height: 1,
        marginTop: 24,
        marginBottom: 24,
        borderWidth: 0,
      },
      // Lists - unordered
      ul: {
        marginTop: 12,
        marginBottom: 20,
        paddingLeft: 24,
      },
      // Lists - ordered
      ol: {
        marginTop: 12,
        marginBottom: 20,
        paddingLeft: 24,
      },
      // List items with proper spacing
      li: {
        fontFamily: 'EBGaramond_400Regular',
        fontSize: 18,
        lineHeight: 30,
        color: textColor,
        marginBottom: 8,
        paddingLeft: 8,
      },
      // Tables
      table: {
        marginTop: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: lightGreyColor,
        borderRadius: 8,
      },
      thead: {
        backgroundColor: midGreyColor,
      },
      tbody: {
        backgroundColor: bgColor,
      },
      tr: {
        borderBottomWidth: 1,
        borderBottomColor: lightGreyColor,
      },
      th: {
        fontFamily: 'EBGaramond_600SemiBold',
        fontSize: 16,
        lineHeight: 24,
        color: textColor,
        padding: 12,
        textAlign: 'left' as const,
      },
      td: {
        fontFamily: 'EBGaramond_400Regular',
        fontSize: 16,
        lineHeight: 24,
        color: textColor,
        padding: 12,
      },
      // Figure and caption
      figure: {
        marginTop: 20,
        marginBottom: 20,
        marginLeft: 0,
        marginRight: 0,
      },
      figcaption: {
        fontFamily: 'EBGaramond_400Regular',
        fontSize: 14,
        lineHeight: 20,
        color: greyColor,
        textAlign: 'center' as const,
        marginTop: 8,
      },
      // Images
      img: {
        marginTop: 16,
        marginBottom: 16,
      },
      // Superscript and subscript
      sup: {
        fontSize: 14,
        lineHeight: 14,
      },
      sub: {
        fontSize: 14,
        lineHeight: 14,
      },
      // Small text
      small: {
        fontSize: 14,
        lineHeight: 22,
        color: greyColor,
      },
      // Abbreviation
      abbr: {
        textDecorationLine: 'underline' as const,
        textDecorationStyle: 'dotted' as const,
      },
      // Citation
      cite: {
        fontFamily: 'EBGaramond_500Medium',
        fontStyle: 'italic' as const,
        color: greyColor,
      },
      // Keyboard input
      kbd: {
        fontFamily: 'GeistMono_500Medium',
        fontSize: 14,
        backgroundColor: midGreyColor,
        color: textColor,
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: colors.muted_green,
      },
      // Sample output
      samp: {
        fontFamily: 'GeistMono_400Regular',
        fontSize: 16,
        backgroundColor: midGreyColor,
        color: textColor,
      },
      // Variable
      var: {
        fontFamily: 'EBGaramond_400Regular',
        fontStyle: 'italic' as const,
        color: colors.primary,
      },
      // Definition
      dfn: {
        fontFamily: 'EBGaramond_600SemiBold',
      },
      // Time element
      time: {
        fontFamily: 'EBGaramond_400Regular',
        color: greyColor,
      },
    }),
    [textColor, greyColor, bgColor, lightGreyColor, midGreyColor, colors]
  );

  const systemFonts = useMemo(
    () => [
      'EBGaramond_400Regular',
      'EBGaramond_500Medium',
      'EBGaramond_600SemiBold',
      'EBGaramond_700Bold',
      'Geist_400Regular',
      'Geist_500Medium',
      'Geist_600SemiBold',
      'Geist_700Bold',
      'GeistMono_400Regular',
      'GeistMono_500Medium',
      'GeistMono_600SemiBold',
      'GeistMono_700Bold',
      'serif',
      ...Constants.systemFonts,
    ],
    []
  );

  const classesStyles = useMemo(
    () => ({
      'list-marker': {
        marginRight: 8,
        minWidth: 20,
      },
    }),
    []
  );

  const feedTitle =
    typeof article.feed === 'object' && article.feed ? article.feed.title : undefined;
  const feedImageUrl =
    typeof article.feed === 'object' && article.feed ? article.feed.image_url : undefined;

  // Try multiple ways to get the feed ID
  let feedId: string | undefined;
  if (typeof article.feed === 'object' && article.feed) {
    feedId = (article.feed as any).id;
  } else if (typeof article.feed === 'string') {
    feedId = article.feed;
  }

  // Check if there's a feed_id field directly on the article
  if (!feedId && (article as any).feed_id) {
    feedId = (article as any).feed_id;
  }

  // For clipped articles, show domain and use created_at as saved date
  const displaySource = isClipped ? extractDomain(article.link) : feedTitle;
  const displayDate = isClipped
    ? `Saved ${new Date(article.created_at).toLocaleDateString()}`
    : article.published_at
      ? new Date(article.published_at).toLocaleDateString()
      : 'Unknown date';

  // Get favicon URL for clipped articles
  const getFaviconUrl = (url: string): string => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return '';
    }
  };

  const displayFaviconUrl = isClipped && article.link ? getFaviconUrl(article.link) : feedImageUrl;

  // Calculate reading time from content with proper CJK support
  const readTimeMinutes = useMemo(() => {
    if (article.content) {
      return calculateReadingTime(article.content);
    }
    return article.estimated_read_time_minutes || 1;
  }, [article.content, article.estimated_read_time_minutes]);

  const readTime = `${readTimeMinutes} min read`;

  // Remove the first image from HTML content if it matches the featured image
  const cleanedContent = useMemo(() => {
    if (!article.content || !article.image_url) return article.content;
    // Normalize URLs by decoding HTML entities
    const normalizeUrl = (url: string) => {
      return url
        .replace(/&amp;/g, '&')
        .replace(/&#038;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
    };

    const normalizedImageUrl = normalizeUrl(article.image_url);
    let content = article.content;

    // Remove img tags that match the featured image
    const imgPattern = /<img[^>]*src=["'][^"']*["'][^>]*>/gi;
    content = content.replace(imgPattern, (match) => {
      const normalizedMatch = normalizeUrl(match);
      return normalizedMatch.includes(normalizedImageUrl) ? '' : match;
    });

    // Remove figure tags containing the featured image
    const figurePattern =
      /<figure[^>]*>[\s\S]*?<img[^>]*src=["'][^"']*["'][^>]*>[\s\S]*?<\/figure>/gi;
    content = content.replace(figurePattern, (match) => {
      const normalizedMatch = normalizeUrl(match);
      return normalizedMatch.includes(normalizedImageUrl) ? '' : match;
    });

    // Clean up any empty figure tags left behind
    content = content.replace(/<figure[^>]*>\s*<figcaption>\s*<\/figcaption>\s*<\/figure>/gi, '');
    content = content.replace(/<figure[^>]*>\s*<\/figure>/gi, '');

    return content;
  }, [article.content, article.image_url]);

  return (
    <ScrollView
      className="flex-1 bg-background dark:bg-background-dark"
      contentContainerStyle={{
        paddingBottom: 80,
      }}
      onScroll={handleScroll}
      scrollEventThrottle={16}>
      {/* Featured Image with Galeria */}
      {article.image_url && (
        <Galeria urls={[article.image_url]}>
          <Galeria.Image>
            <View className="w-full bg-black" style={{ height: 240, marginTop: actionBarOffset }}>
              <Image
                source={{ uri: article.image_url }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                priority="high"
              />
            </View>
          </Galeria.Image>
        </Galeria>
      )}

      {/* Article Header */}
      <View
        className="mx-6 mb-6 border-b border-grey4 pb-6 dark:border-grey4-dark"
        style={{ marginTop: article.image_url ? 24 : actionBarOffset }}>
        {/* Source */}
        {!isClipped && feedId ? (
          <Pressable
            onPress={() => {
              router.push(`/(protected)/(tabs)/discover/feed/${feedId}`);
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
              <Image
                source={{ uri: displayFaviconUrl }}
                style={{ width: 16, height: 16, borderRadius: 2 }}
                contentFit="contain"
              />
            )}
            <Text className="font-geist text-sm uppercase tracking-wide text-grey dark:text-grey-dark">
              {displaySource || 'Unknown Source'}
            </Text>
          </Pressable>
        ) : (
          <View className="mb-2 flex-row items-center gap-2">
            {displayFaviconUrl && (
              <Image
                source={{ uri: displayFaviconUrl }}
                style={{ width: 16, height: 16, borderRadius: 2 }}
                contentFit="contain"
              />
            )}
            <Text className="font-geist text-sm uppercase tracking-wide text-grey dark:text-grey-dark">
              {displaySource || 'Unknown Source'}
            </Text>
          </View>
        )}

        {/* Title */}
        <Text
          className="mb-3 font-geist-bold text-3xl leading-tight text-primary-foreground dark:text-primary-foreground-dark"
          style={{ letterSpacing: -0.72 }}>
          {stripHtml(article.title)}
        </Text>

        {/* Note for clipped articles */}
        {isClipped && article.note && (
          <View className="mb-3 rounded-lg border border-grey4 bg-grey6 px-3 py-2 dark:border-grey4-dark dark:bg-grey6-dark">
            <Text className="font-geist text-sm leading-relaxed text-grey dark:text-grey-dark">
              {article.note}
            </Text>
          </View>
        )}

        {/* Metadata */}
        <View className="flex-row flex-wrap items-center gap-2">
          {article.author && !isClipped && (
            <>
              <Text
                className="font-geist flex-shrink text-sm text-grey dark:text-grey-dark"
                numberOfLines={1}>
                By {article.author}
              </Text>
              <Text className="font-geist text-sm text-grey dark:text-grey-dark">/</Text>
            </>
          )}
          <Text
            className="font-geist flex-shrink text-sm text-grey dark:text-grey-dark"
            numberOfLines={1}>
            {displayDate}
          </Text>
          {readTime && <Text className="font-geist text-sm text-grey dark:text-grey-dark">/</Text>}
          {readTime && (
            <Text
              className="font-geist flex-shrink text-sm text-grey dark:text-grey-dark"
              numberOfLines={1}>
              {readTime}
            </Text>
          )}
        </View>
      </View>

      {/* Article Content */}
      <View className="px-6">
        <RenderHTML
          defaultTextProps={{
            selectable: true,
          }}
          contentWidth={width - 48}
          source={{ html: cleanedContent || '<p>No content available</p>' }}
          tagsStyles={tagsStyles}
          systemFonts={systemFonts}
          classesStyles={classesStyles}
          enableExperimentalMarginCollapsing
          enableCSSInlineProcessing={false}
          renderersProps={{
            ul: {
              markerTextStyle: {
                fontFamily: 'EBGaramond_400Regular',
                fontSize: 18,
                color: textColor,
              },
            },
            ol: {
              markerTextStyle: {
                fontFamily: 'EBGaramond_400Regular',
                fontSize: 18,
                color: textColor,
              },
            },
          }}
        />
      </View>
    </ScrollView>
  );
}
