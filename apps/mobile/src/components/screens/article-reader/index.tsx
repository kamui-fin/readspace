import { ArticleFeaturedImage } from '@components/screens/article-reader/ui/article-featured-image';
import { ArticleHeader } from '@components/screens/article-reader/ui/article-header';
import { Skeleton } from '@components/ui/skeleton';
import { useFavicon } from '@hooks/useFavicon';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import type { Article } from '@readspace/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  View,
} from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

export interface ArticleReaderProps {
  article: Article;
  scrollY: SharedValue<number>;
  lastScrollY: SharedValue<number>;
  scrollDirection: SharedValue<'up' | 'down'>;
  isLoadingContent?: boolean;
}

export function ArticleReader({
  article,
  scrollY,
  lastScrollY,
  scrollDirection,
  isLoadingContent = false,
}: ArticleReaderProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const webViewRef = useRef<WebView>(null);
  const [webViewHeight, setWebViewHeight] = useState(1);
  const [isReady, setIsReady] = useState(false);

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

  // Handle dark mode / theme change inside WebView dynamically
  useEffect(() => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        document.documentElement.style.setProperty('--color-text', '${textColor}');
        document.documentElement.style.setProperty('--color-grey', '${greyColor}');
        document.documentElement.style.setProperty('--color-bg', '${bgColor}');
        document.documentElement.style.setProperty('--color-grey-light', '${lightGreyColor}');
        document.documentElement.style.setProperty('--color-grey-mid', '${midGreyColor}');
        document.documentElement.style.setProperty('--color-secondary', '${colors.secondary}');
        document.documentElement.style.setProperty('--color-primary', '${colors.primary}');
        document.documentElement.style.setProperty('--color-muted-green', '${colors.muted_green}');
        true;
      `);
    }
  }, [textColor, greyColor, bgColor, lightGreyColor, midGreyColor, colors]);

  const htmlContent = useMemo(() => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..800;1,400..800&family=Geist+Mono:wght@100..900&display=swap');

    :root {
      --color-text: ${textColor};
      --color-grey: ${greyColor};
      --color-bg: ${bgColor};
      --color-grey-light: ${lightGreyColor};
      --color-grey-mid: ${midGreyColor};
      --color-secondary: ${colors.secondary};
      --color-primary: ${colors.primary};
      --color-muted-green: ${colors.muted_green};
    }

    html, body {
      background-color: var(--color-bg);
      color: var(--color-text);
      margin: 0;
      padding: 0;
      font-family: 'EB Garamond', Georgia, Cambria, "Times New Roman", Times, serif;
      font-size: 18px;
      line-height: 1.65;
      -webkit-text-size-adjust: 100%;
    }

    #readspace-reader-content {
      padding-left: 24px;
      padding-right: 24px;
      padding-bottom: 24px;
      overflow: hidden;
    }

    * {
      box-sizing: border-box;
    }

    p {
      margin-top: 0;
      margin-bottom: 20px;
      font-size: 18px;
      line-height: 1.65;
      word-wrap: break-word;
    }

    h1, h2, h3, h4, h5, h6 {
      font-family: 'EB Garamond', Georgia, Cambria, "Times New Roman", Times, serif;
      color: var(--color-text);
      font-weight: 700;
      line-height: 1.25;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }

    h1 { font-size: 32px; font-weight: 700; }
    h2 { font-size: 28px; font-weight: 700; }
    h3 { font-size: 24px; font-weight: 600; }
    h4 { font-size: 20px; font-weight: 600; }
    h5 { font-size: 18px; font-weight: 600; }
    h6 { font-size: 16px; font-weight: 600; }

    strong, b {
      font-weight: 700;
    }

    em, i {
      font-style: italic;
    }

    u {
      text-decoration: underline;
    }

    s, del, strike {
      text-decoration: line-through;
      color: var(--color-grey);
    }

    mark {
      background-color: var(--color-muted-green);
      color: var(--color-text);
      padding: 0 4px;
      border-radius: 2px;
    }

    a {
      color: var(--color-secondary);
      text-decoration: underline;
      font-weight: 500;
    }

    code {
      font-family: 'Geist Mono', Consolas, "Liberation Mono", Menlo, Courier, monospace;
      font-size: 15px;
      background-color: var(--color-grey-mid);
      color: var(--color-primary);
      padding: 2px 6px;
      border-radius: 4px;
      word-wrap: break-word;
    }

    pre {
      font-family: 'Geist Mono', Consolas, "Liberation Mono", Menlo, Courier, monospace;
      font-size: 14px;
      line-height: 1.5;
      background-color: var(--color-grey-mid);
      color: var(--color-text);
      padding: 16px;
      border-radius: 8px;
      margin-top: 16px;
      margin-bottom: 20px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    blockquote {
      font-family: 'EB Garamond', Georgia, Cambria, "Times New Roman", Times, serif;
      font-size: 18px;
      line-height: 1.65;
      color: var(--color-text);
      font-style: italic;
      border-left: 4px solid var(--color-secondary);
      background-color: var(--color-grey-light);
      padding: 16px;
      margin-top: 20px;
      margin-bottom: 20px;
      margin-left: 0;
      margin-right: 0;
    }

    hr {
      background-color: var(--color-grey-light);
      height: 1px;
      margin-top: 24px;
      margin-bottom: 24px;
      border: 0;
    }

    ul, ol {
      margin-top: 12px;
      margin-bottom: 20px;
      padding-left: 24px;
    }

    li {
      font-size: 18px;
      line-height: 1.65;
      margin-bottom: 8px;
      padding-left: 4px;
    }

    img, video, iframe {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin-top: 16px;
      margin-bottom: 16px;
      display: block;
    }

    figure {
      margin-top: 20px;
      margin-bottom: 20px;
      margin-left: 0;
      margin-right: 0;
      text-align: center;
    }

    figcaption {
      font-size: 14px;
      line-height: 1.45;
      color: var(--color-grey);
      margin-top: 8px;
    }

    table {
      width: 100%;
      margin-top: 20px;
      margin-bottom: 20px;
      border-collapse: collapse;
      border: 1px solid var(--color-grey-light);
      border-radius: 8px;
      overflow: hidden;
    }

    thead {
      background-color: var(--color-grey-mid);
    }

    tbody {
      background-color: var(--color-bg);
    }

    tr {
      border-bottom: 1px solid var(--color-grey-light);
    }

    tr:last-child {
      border-bottom: 0;
    }

    th, td {
      padding: 12px;
      text-align: left;
    }

    th {
      font-weight: 600;
      font-size: 16px;
      line-height: 1.5;
    }

    td {
      font-size: 16px;
      line-height: 1.5;
    }

    sup, sub {
      font-size: 14px;
      line-height: 0;
      position: relative;
      vertical-align: baseline;
    }

    sup {
      top: -0.5em;
    }

    sub {
      bottom: -0.25em;
    }

    small {
      font-size: 14px;
      line-height: 1.5;
      color: var(--color-grey);
    }
  </style>
</head>
<body>
  <div id="readspace-reader-content">
    ${cleanedContent || '<p>No content available</p>'}
  </div>
  <script>
    // Intercept clicks on anchor tags
    document.addEventListener('click', function(e) {
      var target = e.target;
      while (target && target.tagName !== 'A') {
        target = target.parentNode;
      }
      if (target && target.tagName === 'A' && target.href) {
        e.preventDefault();
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'link', value: target.href }));
      }
    });
  </script>
</body>
</html>
    `;
  }, [cleanedContent, textColor, greyColor, bgColor, lightGreyColor, midGreyColor, colors]);

  const webViewSource = useMemo(() => {
    return { html: htmlContent, baseUrl: '' };
  }, [htmlContent]);

  // Reset ready state when content changes
  useEffect(() => {
    setIsReady(false);
    const _c = cleanedContent;
  }, [cleanedContent]);

  // Safety fallback to show content if height isn't received
  useEffect(() => {
    const _c = cleanedContent;
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [cleanedContent]);

  const injectedJS = `
    (function() {
      var container = document.getElementById('readspace-reader-content');
      if (!container) return;

      function sendHeight() {
        var height = Math.ceil(container.getBoundingClientRect().height);
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: height }));
      }
      window.addEventListener('load', sendHeight);
      
      if (window.ResizeObserver) {
        var ro = new ResizeObserver(sendHeight);
        ro.observe(container);
      }
      
      var observer = new MutationObserver(sendHeight);
      observer.observe(container, { subtree: true, childList: true, attributes: true });
      
      setTimeout(sendHeight, 100);
      setTimeout(sendHeight, 500);
      setTimeout(sendHeight, 1000);
    })();
    true;
  `;

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'height') {
        const height = Number(data.value);
        if (height && height > 0) {
          setWebViewHeight(height);
          setIsReady(true);
        }
      } else if (data.type === 'link') {
        const url = data.value;
        if (url) {
          Linking.openURL(url).catch((err) => {
            console.error('Failed to open URL in browser:', err);
          });
        }
      }
    } catch {
      const height = Number(event.nativeEvent.data);
      if (!Number.isNaN(height) && height > 0) {
        setWebViewHeight(height);
        setIsReady(true);
      }
    }
  };

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

      {/* Article Content - rendered inside auto-height WebView or Skeleton */}
      {isLoadingContent ? (
        <View className="px-6">
          <View className="mb-4">
            <Skeleton variant="text" height={20} width="100%" className="mb-1.5" />
            <Skeleton variant="text" height={20} width="100%" className="mb-1.5" />
            <Skeleton variant="text" height={20} width="85%" />
          </View>
          <View className="mb-4">
            <Skeleton variant="text" height={20} width="100%" className="mb-1.5" />
            <Skeleton variant="text" height={20} width="100%" className="mb-1.5" />
            <Skeleton variant="text" height={20} width="70%" />
          </View>
          <View className="mb-4">
            <Skeleton variant="text" height={20} width="100%" className="mb-1.5" />
            <Skeleton variant="text" height={20} width="95%" className="mb-1.5" />
            <Skeleton variant="text" height={20} width="60%" />
          </View>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          scrollEnabled={false}
          style={{
            height: webViewHeight,
            width: '100%',
            backgroundColor: 'transparent',
            opacity: isReady ? 1 : 0,
          }}
          containerStyle={{
            backgroundColor: 'transparent',
          }}
          originWhitelist={['*']}
          source={webViewSource}
          onMessage={handleMessage}
          injectedJavaScript={injectedJS}
        />
      )}
    </ScrollView>
  );
}
