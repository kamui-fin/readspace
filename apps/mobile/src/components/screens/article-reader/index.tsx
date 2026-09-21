import { ArticleFeaturedImage } from '@components/screens/article-reader/ui/article-featured-image';
import { ArticleHeader } from '@components/screens/article-reader/ui/article-header';
import { Skeleton } from '@components/ui/skeleton';
import { ZoomableImage } from '@components/ui/zoomable-image';
import { useFavicon } from '@hooks/useFavicon';
import { useReaderTheme } from '@hooks/useReaderTheme';
import {
  READER_FONT_SIZE_SCALE,
  READER_FONT_SIZES,
  READER_FONT_STACKS,
  READER_LINE_HEIGHTS,
} from '@lib/constants/reader';
import type { Article } from '@readspace/shared';
import { useReaderPreferences } from '@stores/reader-preferences';
import { Image as ExpoImage } from 'expo-image';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Linking,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  type SharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

/** A heading lifted out of the rendered article for the outline sheet. */
export interface OutlineItem {
  id: string;
  text: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  /** Offset of the heading within the WebView document, in px. */
  top: number;
}

export interface ArticleReaderHandle {
  scrollToTop: () => void;
  /** Scroll so a heading at `top` (document coordinates) sits below the chrome. */
  scrollToOutlineItem: (top: number) => void;
}

export interface ArticleReaderProps {
  article: Article;
  scrollY: SharedValue<number>;
  lastScrollY: SharedValue<number>;
  scrollDirection: SharedValue<'up' | 'down'>;
  /** 0..1 through the article. A shared value so the dock's ring can track the
   *  scroll without re-rendering React on every frame. */
  readingProgress?: SharedValue<number>;
  isLoadingContent?: boolean;
  highlightedContent?: string | null;
  highlightsEnabled?: boolean;
  onOutlineChange?: (outline: OutlineItem[]) => void;
  /** Fires only when the heading the reader is inside changes, not per scroll frame. */
  onActiveOutlineChange?: (id: string | null) => void;
  /** A plain tap on the page — not on a link or image, and not ending a text selection. */
  onTap?: () => void;
}

/** Breathing room above a heading we've scrolled to, so it isn't flush with the bar. */
const OUTLINE_SCROLL_PADDING = 24;

/** Distance below the top of the viewport at which a heading counts as "current". */
const ACTIVE_HEADING_LINE = 140;

export const ArticleReader = forwardRef<ArticleReaderHandle, ArticleReaderProps>(
  function ArticleReader(
    {
      article,
      scrollY,
      lastScrollY,
      scrollDirection,
      readingProgress,
      isLoadingContent = false,
      highlightedContent,
      highlightsEnabled = false,
      onOutlineChange,
      onActiveOutlineChange,
      onTap,
    },
    ref
  ) {
    const { colors, isDark } = useReaderTheme();
    const fontSizeIndex = useReaderPreferences((state) => state.fontSizeIndex);
    const fontFamily = useReaderPreferences((state) => state.fontFamily);
    const lineHeight = useReaderPreferences((state) => state.lineHeight);
    const isNewsletter = article.link?.startsWith('newsletter://');

    const webViewRef = useRef<WebView>(null);
    const scrollViewRef = useRef<ScrollView>(null);
    /** Where the WebView starts inside the outer ScrollView — outline offsets are
     *  document-relative, so they need this to become scroll positions. */
    const webViewOffsetY = useRef(0);
    const outlineRef = useRef<OutlineItem[]>([]);
    const activeOutlineId = useRef<string | null>(null);
    const [webViewHeight, setWebViewHeight] = useState(1);
    const [isReady, setIsReady] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

    // Android renders a view with *fractional* opacity into an offscreen hardware
    // layer. For a WebView holding a full article that layer can exceed the GPU's
    // max texture size, at which point the whole thing rasterises solid black and
    // stays that way — nothing re-rasterises it. Generating AI Highlights swaps
    // `source` (the marked-up HTML), which flips `isReady` back to false and
    // re-runs this fade while the WebView is already at its full height: the exact
    // conditions for it. So on Android the WebView snaps in at full opacity and
    // the skeleton's own fade-out carries the transition. iOS has no such limit
    // and keeps the cross-fade.
    const shouldFadeWebView = Platform.OS === 'ios';
    const animatedWebViewStyle = useAnimatedStyle(() => {
      if (!shouldFadeWebView) {
        return { opacity: isReady ? 1 : 0 };
      }
      return {
        opacity: withTiming(isReady ? 1 : 0, { duration: 400 }),
      };
    });

    /**
     * Height of the scroll viewport, captured on layout. `handleScroll` gets this from the
     * event, but a short article never fires one — see `handleContentSizeChange`.
     */
    const viewportHeight = useRef(0);

    /**
     * An article that fits on screen produces no scroll event at all, so progress would sit at
     * its initial 0 forever. Content size is the one signal that always arrives.
     *
     * This has to recompute in *both* directions, not just latch to 1: the WebView reports its
     * collapsed height first and only grows once the article renders, so a one-way "short means
     * finished" rule would pin every article to 100% on open and never let go.
     */
    const handleContentSizeChange = (_width: number, height: number) => {
      // Before the WebView reports its real height the page is "shorter than the viewport" in
      // the most literal sense, which would read as finished. Wait until it has rendered.
      if (!readingProgress || viewportHeight.current === 0 || !isReady) return;
      const scrollableHeight = height - viewportHeight.current;
      readingProgress.value =
        scrollableHeight > 0 ? Math.min(Math.max(lastScrollY.value / scrollableHeight, 0), 1) : 1;
    };

    // Handle scroll events to track position and direction
    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const currentScrollY = contentOffset.y;
      const previousScrollY = lastScrollY.value;

      // Update scroll position
      scrollY.value = currentScrollY;

      // Which heading are we inside? The last one whose top has passed the
      // reading line. Reported only on change, so the dock re-renders per
      // section rather than per frame.
      if (outlineRef.current.length > 0) {
        const readingLine = currentScrollY - webViewOffsetY.current + ACTIVE_HEADING_LINE;
        let activeId: string | null = null;
        for (const item of outlineRef.current) {
          if (item.top <= readingLine) activeId = item.id;
          else break;
        }
        if (activeId !== activeOutlineId.current) {
          activeOutlineId.current = activeId;
          onActiveOutlineChange?.(activeId);
        }
      }

      if (readingProgress) {
        const scrollableHeight = contentSize.height - layoutMeasurement.height;
        // An article shorter than the viewport has nothing left to read, so it's finished — 0
        // here would leave a permanent "0%" on a piece the reader can already see all of.
        readingProgress.value =
          scrollableHeight > 0 ? Math.min(Math.max(currentScrollY / scrollableHeight, 0), 1) : 1;
      }

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
      feedTitle: displaySource || undefined,
      feedImage: feedImageUrl || undefined,
      isClipped: isClipped,
    });

    // Calculate reading time from content with proper CJK support
    const readTimeMinutes = useMemo(() => {
      const contentToUse = article.extracted_content || article.content;
      if (contentToUse) {
        const textLength = contentToUse.replace(/<[^>]*>?/gm, '').length;
        return Math.max(1, Math.ceil(textLength / 1000));
      }
      return 1;
    }, [article.extracted_content, article.content]);

    const readTime = `${readTimeMinutes} min read`;

    // Remove the first image from HTML content if it matches the featured image
    const cleanedContent = useMemo(() => {
      // Use the content prop which respects the view mode selection (original/extracted/translated).
      // Once AI Highlights are generated for this view, the marked-up HTML is baked in permanently —
      // visibility toggles afterward are a CSS class flip via injectedJavaScript, not a content swap.
      const contentToUse = highlightedContent || article.content;

      if (!contentToUse || !article.image_url) {
        return contentToUse;
      }
      // Normalize URLs by decoding HTML entities
      const normalizeUrl = (url: string) => {
        return url
          .replace(/&amp;/g, '&')
          .replace(/&#038;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'");
      };

      const normalizedImageUrl = normalizeUrl(article.image_url);
      let content = contentToUse;

      // Remove img tags that match the featured image (but preserve figure structure)
      const imgPattern = /<img[^>]*src=["'][^"']*["'][^>]*>/gi;
      content = content.replace(imgPattern, (match) => {
        const normalizedMatch = normalizeUrl(match);
        return normalizedMatch.includes(normalizedImageUrl) ? '' : match;
      });

      return content;
    }, [article.extracted_content, article.content, article.image_url, highlightedContent]);

    /**
     * Serif runs small on the x-height and mono runs wide, so the same nominal
     * step needs a per-family nudge to feel like the same size.
     */
    const readerFontSize = Math.round(
      READER_FONT_SIZES[fontSizeIndex] * READER_FONT_SIZE_SCALE[fontFamily]
    );

    /**
     * Every runtime-controlled CSS variable in one script: page colours and
     * reader typography. Runs before first paint (so nothing flashes at the
     * default) and again on change (so nothing reloads).
     */
    const readerVariablesScript = useMemo(() => {
      const variables: Record<string, string> = {
        '--color-text': colors.primary_foreground,
        '--color-grey': colors.grey,
        '--color-bg': colors.background,
        '--color-grey-light': colors.grey6,
        '--color-grey-mid': colors.grey5,
        '--color-secondary': colors.secondary,
        '--color-primary': colors.primary,
        '--color-muted-green': colors.muted_green,
        '--color-code-text': isDark ? colors.secondary : colors.primary,
        // Highlights need more paint on a dark page to read at the same strength.
        '--rs-highlight-alpha': isDark ? '58%' : '45%',
        '--rs-highlight-alpha-2': isDark ? '36%' : '26%',
        '--reader-font-size': `${readerFontSize}px`,
        '--reader-font-family': READER_FONT_STACKS[fontFamily],
        '--reader-line-height': String(READER_LINE_HEIGHTS[lineHeight]),
      };

      // JSON.stringify quotes and escapes — font stacks contain single quotes.
      const assignments = Object.entries(variables)
        .map(([name, value]) => `s.setProperty('${name}', ${JSON.stringify(value)});`)
        .join('');

      return `(function(){var s=document.documentElement.style;${assignments}})();true;`;
    }, [colors, isDark, readerFontSize, fontFamily, lineHeight]);

    // Applies to the already-rendered page. `injectedJavaScriptBeforeContentLoaded`
    // covers the first paint and any reload; this covers live changes.
    useEffect(() => {
      webViewRef.current?.injectJavaScript(readerVariablesScript);
    }, [readerVariablesScript]);

    // Toggle AI Highlights visibility via a class flip on the already-rendered page — no
    // WebView reload. Re-fires on every load (isReady flips false->true on a real reload,
    // e.g. right after highlights are first generated), which is also when the capped
    // reading-order stagger indices get (re)applied for the sweep-in animation.
    useEffect(() => {
      if (webViewRef.current && isReady) {
        webViewRef.current.injectJavaScript(`
        (function() {
          var el = document.getElementById('readspace-reader-content');
          if (!el) return true;
          if (${highlightsEnabled}) {
            el.classList.add('rs-highlights-on');
            var marks = el.querySelectorAll('.rs-highlight');
            for (var i = 0; i < marks.length; i++) {
              marks[i].style.setProperty('--rs-highlight-index', String(Math.min(i, 20)));
            }
          } else {
            el.classList.remove('rs-highlights-on');
          }
        })();
        true;
      `);
      }
    }, [highlightsEnabled, isReady]);

    const htmlContent = useMemo(() => {
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data: blob:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; script-src 'unsafe-inline'; media-src https: http:; frame-src https: http:;" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..800;1,400..800&family=Geist:ital,wght@0,100..900;1,100..900&family=Geist+Mono:wght@100..900&display=swap');

    /* Placeholders only. Every value below is overwritten before first paint by
       \`readerVariablesScript\` (injectedJavaScriptBeforeContentLoaded) and again
       whenever the theme or a reader setting changes. Keeping them out of the
       HTML string is what lets typography change *without* rebuilding
       \`source\` — no reload, no lost scroll position, no skeleton flash. */
    :root {
      --color-text: #232222;
      --color-grey: rgb(159, 162, 160);
      --color-bg: rgb(255, 255, 255);
      --color-grey-light: rgb(243, 243, 243);
      --color-grey-mid: rgb(237, 237, 237);
      --color-secondary: #6A994E;
      --color-primary: #386641;
      --color-muted-green: #D1DBCD;
      --color-code-text: #386641;
      --reader-font-size: 19px;
      --reader-font-family: 'EB Garamond', Georgia, Cambria, 'Times New Roman', Times, serif;
      --reader-line-height: 1.65;
      --rs-highlight-alpha: 45%;
      --rs-highlight-alpha-2: 26%;
    }

    html, body {
      background-color: var(--color-bg);
      color: var(--color-text);
      margin: 0;
      padding: 0;
      ${isNewsletter ? '' : 'font-family: var(--reader-font-family);'}
      font-size: ${isNewsletter ? '16px' : 'var(--reader-font-size)'};
      line-height: var(--reader-line-height);
      -webkit-text-size-adjust: 100%;
    }

    #readspace-reader-content {
      padding-left: ${isNewsletter ? '0' : '24px'};
      padding-right: ${isNewsletter ? '0' : '24px'};
      padding-bottom: ${isNewsletter ? '0' : '24px'};
      overflow-x: ${isNewsletter ? 'auto' : 'hidden'};
      overflow-y: hidden;
    }

    * {
      box-sizing: border-box;
    }

    /* AI Highlights (Skim Mode) — invisible until #readspace-reader-content carries
       .rs-highlights-on, toggled via injectedJavaScript so the marked-up HTML can be
       baked in once and shown/hidden without a WebView reload. Applies to newsletters
       too, unlike Translate. */
    mark.rs-highlight {
      background-color: transparent;
      background-image: none;
      color: inherit;
      padding: 0;
      border-radius: 3px;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
    }
    #readspace-reader-content.rs-highlights-on mark.rs-highlight {
      --rs-highlight-color: color-mix(in srgb, var(--color-secondary) var(--rs-highlight-alpha), transparent);
      background-image: linear-gradient(90deg, var(--rs-highlight-color) 0%, var(--rs-highlight-color) 100%);
      background-repeat: no-repeat;
      background-size: 0% 100%;
      background-position: left center;
      padding: 0 1px;
      animation: rs-highlight-sweep 320ms ease-out forwards;
      animation-delay: calc(var(--rs-highlight-index, 0) * 30ms);
    }
    #readspace-reader-content.rs-highlights-on mark.rs-highlight[data-rank="2"] {
      --rs-highlight-color: color-mix(in srgb, var(--color-secondary) var(--rs-highlight-alpha-2), transparent);
    }
    @keyframes rs-highlight-sweep {
      from { background-size: 0% 100%; }
      to   { background-size: 100% 100%; }
    }
    @media (prefers-reduced-motion: reduce) {
      #readspace-reader-content.rs-highlights-on mark.rs-highlight {
        animation: none;
        background-size: 100% 100%;
      }
    }

    ${
      isNewsletter
        ? `
      /* Newsletter-specific responsive resets */
      img, video, iframe {
        max-width: 100% !important;
        height: auto !important;
      }
      table {
        max-width: 100% !important;
      }
    `
        : `
      /* Normal article styles */
      p {
        margin-top: 0;
        margin-bottom: 20px;
        font-size: var(--reader-font-size);
        line-height: var(--reader-line-height);
        word-wrap: break-word;
      }

      h1, h2, h3, h4, h5, h6 {
        font-family: var(--reader-font-family);
        color: var(--color-text);
        font-weight: 700;
        line-height: 1.25;
        margin-top: 1.5em;
        margin-bottom: 0.5em;
      }

      /* Ratios against the body size, so the whole hierarchy moves together
         when the reader changes text size. At the 19px default these land on
         the original 32/28/24/20/19/17px. */
      h1 { font-size: calc(var(--reader-font-size) * 1.68); font-weight: 700; }
      h2 { font-size: calc(var(--reader-font-size) * 1.47); font-weight: 700; }
      h3 { font-size: calc(var(--reader-font-size) * 1.26); font-weight: 600; }
      h4 { font-size: calc(var(--reader-font-size) * 1.05); font-weight: 600; }
      h5 { font-size: var(--reader-font-size); font-weight: 600; }
      h6 { font-size: calc(var(--reader-font-size) * 0.89); font-weight: 600; }

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
        font-size: calc(var(--reader-font-size) * 0.82);
        background-color: var(--color-grey-mid);
        color: var(--color-code-text);
        padding: 2px 6px;
        border-radius: 4px;
        word-wrap: break-word;
      }

      pre {
        font-family: 'Geist Mono', Consolas, "Liberation Mono", Menlo, Courier, monospace;
        font-size: calc(var(--reader-font-size) * 0.76);
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

      pre code {
        color: var(--color-text);
      }

      blockquote {
        font-family: var(--reader-font-family);
        font-size: var(--reader-font-size);
        line-height: var(--reader-line-height);
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
        font-size: var(--reader-font-size);
        line-height: var(--reader-line-height);
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
    `
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
      // Deliberately depends on content and structure only. Colours and
      // typography arrive as CSS variables at runtime, so changing either never
      // rebuilds this string and never reloads the WebView.
    }, [cleanedContent, isNewsletter]);

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

      // Headings, for the outline sheet. Recomputed alongside the height
      // because anything that changes the height (text size, highlights,
      // late-loading images) also moves every heading's offset.
      function readOutline() {
        var nodes = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
        var items = [];
        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          var text = (node.textContent || '').replace(/\\s+/g, ' ').trim();
          if (!text) continue;
          items.push({
            id: 'rs-outline-' + i,
            text: text,
            level: Number(node.tagName.slice(1)),
            top: Math.round(node.getBoundingClientRect().top + window.scrollY)
          });
        }
        return items;
      }

      // Coalesced to one measurement per frame and deduped by height. The
      // MutationObserver below watches attributes on the whole subtree, and the
      // AI Highlights injection writes an inline custom property on every
      // <mark> — without this, a highlighted article floods the bridge with
      // identical messages, each one a React re-render on the RN side.
      var pendingFrame = false;
      var lastSentHeight = -1;
      function sendMetrics() {
        if (pendingFrame) return;
        pendingFrame = true;
        requestAnimationFrame(function () {
          pendingFrame = false;
          var height = Math.ceil(container.getBoundingClientRect().height);
          if (height === lastSentHeight) return;
          lastSentHeight = height;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'metrics',
            value: height,
            outline: readOutline()
          }));
        });
      }
      window.addEventListener('load', sendMetrics);

      if (window.ResizeObserver) {
        var ro = new ResizeObserver(sendMetrics);
        ro.observe(container);
      }

      var observer = new MutationObserver(sendMetrics);
      observer.observe(container, { subtree: true, childList: true, attributes: true });

      setTimeout(sendMetrics, 100);
      setTimeout(sendMetrics, 500);
      setTimeout(sendMetrics, 1000);

      // A tap on plain content toggles the reader chrome. Links, images and
      // interactive elements own their own taps, and a tap that finishes a text
      // selection must not also flip the chrome under the user's finger.
      document.addEventListener('click', function(e) {
        var target = e.target;
        if (target && target.closest && target.closest('a, img, button, input, select, textarea, summary, video, audio, iframe')) return;
        if (String(window.getSelection && window.getSelection()).length > 0) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tap' }));
      });

      // Intercept clicks on images
      document.addEventListener('click', function(e) {
        var target = e.target;
        if (target && target.tagName === 'IMG' && target.src) {
          e.preventDefault();
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'image', value: target.src }));
        }
      });
    })();
    true;
  `;

    const handleMessage = (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'metrics') {
          const height = Number(data.value);
          if (height && height > 0) {
            setWebViewHeight(height);
            setIsReady(true);
          }
          if (Array.isArray(data.outline)) {
            outlineRef.current = data.outline as OutlineItem[];
            onOutlineChange?.(outlineRef.current);
          }
        } else if (data.type === 'link') {
          const url = data.value;
          if (
            url &&
            (url.startsWith('http://') ||
              url.startsWith('https://') ||
              url.startsWith('mailto:'))
          ) {
            Linking.openURL(url).catch((err) => {
              console.error('Failed to open URL in browser:', err);
            });
          }
        } else if (data.type === 'tap') {
          onTap?.();
        } else if (data.type === 'image') {
          setSelectedImageUrl(data.value);
        }
      } catch {
        const height = Number(event.nativeEvent.data);
        if (!Number.isNaN(height) && height > 0) {
          setWebViewHeight(height);
          setIsReady(true);
        }
      }
    };

    const scrollToTop = useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, []);

    const scrollToOutlineItem = useCallback((top: number) => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(webViewOffsetY.current + top - OUTLINE_SCROLL_PADDING, 0),
        animated: true,
      });
    }, []);

    useImperativeHandle(ref, () => ({ scrollToTop, scrollToOutlineItem }), [
      scrollToTop,
      scrollToOutlineItem,
    ]);

    return (
      <>
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={{
            paddingBottom: 80,
          }}
          onScroll={handleScroll}
          onContentSizeChange={handleContentSizeChange}
          onLayout={(e) => {
            viewportHeight.current = e.nativeEvent.layout.height;
          }}
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
          <View
            style={{ position: 'relative', minHeight: isLoadingContent || !isReady ? 240 : 0 }}
            onLayout={(e) => {
              webViewOffsetY.current = e.nativeEvent.layout.y;
            }}>
            {(isLoadingContent || !isReady) && (
              <Animated.View
                key="content-skeleton"
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(300)}
                style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
                className="px-6">
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
              </Animated.View>
            )}

            {!isLoadingContent && (
              <Animated.View style={animatedWebViewStyle}>
                <WebView
                  ref={webViewRef}
                  scrollEnabled={isNewsletter}
                  style={{
                    height: webViewHeight,
                    width: '100%',
                    backgroundColor: 'transparent',
                  }}
                  containerStyle={{
                    backgroundColor: 'transparent',
                  }}
                  originWhitelist={['*']}
                  source={webViewSource}
                  onMessage={handleMessage}
                  onShouldStartLoadWithRequest={(request) => {
                    if (
                      request.url === 'about:blank' ||
                      request.url.startsWith('data:')
                    ) {
                      return true;
                    }
                    if (
                      request.url.startsWith('http://') ||
                      request.url.startsWith('https://') ||
                      request.url.startsWith('mailto:')
                    ) {
                      Linking.openURL(request.url).catch(() => {});
                    }
                    return false;
                  }}
                  injectedJavaScript={injectedJS}
                  injectedJavaScriptBeforeContentLoaded={readerVariablesScript}
                />
              </Animated.View>
            )}
          </View>
        </ScrollView>
        <Modal
          visible={!!selectedImageUrl}
          transparent={false}
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setSelectedImageUrl(null)}>
          <View
            style={{
              flex: 1,
              backgroundColor: '#000',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {selectedImageUrl && <ZoomableImage uri={selectedImageUrl} />}
            {/* Floating Close Button */}
            <Pressable
              style={{
                position: 'absolute',
                top: 54,
                right: 20,
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                borderRadius: 20,
                width: 36,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 99,
              }}
              onPress={() => setSelectedImageUrl(null)}>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '600', marginTop: -2 }}>
                ×
              </Text>
            </Pressable>
          </View>
        </Modal>
      </>
    );
  }
);
