import { useHtmlStyles } from '@components/screens/article-reader/constants/html-styles';
import { ArticleFeaturedImage } from '@components/screens/article-reader/ui/article-featured-image';
import { ArticleHeader } from '@components/screens/article-reader/ui/article-header';
import { useFavicon } from '@hooks/useFavicon';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';

import type { Article } from '@readspace/shared';
import { useMemo } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { RenderHTML } from '@native-html/render';

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
  const { width } = useWindowDimensions();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

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
  const { tagsStyles, systemFonts, classesStyles, renderersProps } = useHtmlStyles(
    textColor,
    greyColor,
    bgColor,
    lightGreyColor,
    midGreyColor,
    colors
  );

  const feedTitle = article.feed_title;
  const feedImageUrl = article.feed_icon;
  const feedId = article.feed_id || undefined;

  // For clipped articles, show domain and use created_at as saved date
  const displaySource = isClipped ? extractDomain(article.link) : feedTitle;
  const displayDate = isClipped
    ? `Saved ${new Date(article.created_at).toLocaleDateString()}`
    : article.published_at
      ? new Date(article.published_at).toLocaleDateString()
      : 'Unknown date';

  const { iconUrl, fallbackComponent } = useFavicon({
    url: article.link,
    feedTitle: feedTitle || undefined,
    feedImage: feedImageUrl || undefined,
    isClipped: isClipped,
  });

  // Calculate reading time from content with proper CJK support
  const readTimeMinutes = useMemo(() => {
    if (article.content) {
      const textLength = article.content.replace(/<[^>]*>?/gm, '').length;
      return Math.max(1, Math.ceil(textLength / 1000));
    }
    return 1;
  }, [article.content]);

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

  // Memoize renderers to prevent unnecessary re-renders of RenderHTML
  const renderers = useMemo(
    () => ({
      // biome-ignore lint/suspicious/noExplicitAny: react-native-render-html renderer types are complex
      a: (props: any) => {
        // Check if link is inside an italic context by examining parent styles
        const tnode = props.TDefaultRenderer?.props?.tnode;
        const parentDomNode = tnode?.parent?.domNode;
        const parentTagName = parentDomNode?.name;

        // Check if parent is em or i, or if link contains em/i
        const linkInnerHTML = tnode?.domNode?.innerHTML || '';
        const isInsideItalic =
          parentTagName === 'em' ||
          parentTagName === 'i' ||
          linkInnerHTML.toLowerCase().includes('<em>') ||
          linkInnerHTML.toLowerCase().includes('<i>');

        // Apply italic font if inside italic context
        const linkStyle = isInsideItalic
          ? {
              ...tagsStyles.a,
              fontFamily: 'EBGaramond_500Medium_Italic',
              fontStyle: 'italic' as const,
            }
          : tagsStyles.a;

        // Safely access tbaseStyle with null check
        const baseTStyle = props.TDefaultRenderer?.props?.tbaseStyle || {};

        return (
          <props.TDefaultRenderer
            {...props}
            tbaseStyle={{
              ...baseTStyle,
              ...linkStyle,
            }}
          />
        );
      },
    }),
    [tagsStyles.a]
  );

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerStyle={{
        paddingBottom: 80,
      }}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}>
      {/* Featured Image with Galeria - Edge-to-edge */}
      {article.image_url && <ArticleFeaturedImage imageUrl={article.image_url} />}

      {/* Article Header */}
      <ArticleHeader
        article={article}
        isClipped={isClipped}
        feedId={feedId}
        displayFaviconUrl={iconUrl}
        fallbackComponent={fallbackComponent}
        displaySource={displaySource || 'Unknown Source'}
        displayDate={displayDate}
        readTime={readTime}
      />

      {/* Article Content - Edge-to-edge with horizontal padding */}
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
          renderersProps={renderersProps}
          renderers={renderers}
        />
      </View>
    </ScrollView>
  );
}
