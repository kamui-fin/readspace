import {
  ArticleOptionsBottomSheet,
  type ArticleViewMode,
} from '@components/bottom-sheets/article-options';
import { ArticleOutlineBottomSheet } from '@components/bottom-sheets/article-outline';
import { ArticleSummaryBottomSheet } from '@components/bottom-sheets/article-summary';
import { ReaderSettingsBottomSheet } from '@components/bottom-sheets/reader-settings';
import type { ArticleReaderHandle, OutlineItem } from '@components/screens/article-reader/index';
import { ArticleReader } from '@components/screens/article-reader/index';
import { ArticleActionBar } from '@components/screens/article-reader/ui/article-actions.bar';
import { ArticleReaderSkeleton } from '@components/screens/article-reader/ui/article-reader.skeleton';
import { ReaderBottomBar } from '@components/screens/article-reader/ui/reader-bottom-bar';
import type { LanguageOption } from '@components/screens/discover/ui/language-picker.dropdown';
import { LanguagePicker } from '@components/screens/discover/ui/language-picker.dropdown';
import type { SheetRef } from '@components/ui/bottom-sheet';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useLimitChecker } from '@hooks/useLimitChecker';
import { useReaderTheme } from '@hooks/useReaderTheme';
import { READ_LATER_READER_MODE } from '@lib/constants/app';
import { SUPPORTED_LANGUAGES } from '@lib/constants/languages';
import { recordReviewActivity } from '@lib/review';
import { getAdjacentArticle } from '@lib/utils/article';
import {
  getCachedArticleState,
  isPaywallError,
  queryKeys,
  useArticle,
  useExtractFullTextMutation,
  useGenerateHighlightsMutation,
  useSummarizeArticleMutation,
  useTranslateArticleMutation,
  useUpdateArticle,
} from '@readspace/shared';
import { useTranslationHistory } from '@stores/translation-history';
import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Linking, Share, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';

/** How far into the article before scrolling down starts hiding the chrome. */
const CHROME_AUTO_HIDE_AFTER = 96;
/** Per-frame downward travel that counts as deliberate scrolling rather than jitter. */
const CHROME_AUTO_HIDE_TRAVEL = 4;
/** Back within this of the top counts as "at the top", where the chrome returns on its own. */
const CHROME_REVEAL_AT_TOP = 8;

/** Fewer headings than this and an outline tells you nothing you can't already see. */
const MIN_OUTLINE_ITEMS = 3;

interface ArticleScreenProps {
  articleId: string;
  /** 'feed' | 'clipped' — required to fetch clipped articles */
  articleType?: string;
  isSubscribed?: boolean;
  /** Opened from the Saved tab: checkmark marks read, unsaves, and advances */
  isReadLaterMode?: boolean;
}

export function ArticleScreen({
  articleId,
  articleType,
  isSubscribed = true,
  isReadLaterMode = false,
}: ArticleScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useReaderTheme();
  const scrollY = useSharedValue(0);
  const lastScrollY = useSharedValue(0);
  const scrollDirection = useSharedValue<'up' | 'down'>('down');
  const readingProgress = useSharedValue(0);
  const readerRef = useRef<ArticleReaderHandle>(null);

  // An outline of one or two headings is noise, not navigation — below this the
  // reader doesn't offer the control at all.
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const hasOutline = outline.length >= MIN_OUTLINE_ITEMS;
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const activeSectionLabel = hasOutline
    ? (outline.find((item) => item.id === activeSectionId)?.text ?? null)
    : null;

  // Tapping the page toggles the chrome, like Apple Books. It opens visible so
  // the controls are discoverable, then steps aside once reading starts.
  const [chromeVisible, setChromeVisible] = useState(true);
  const handleToggleChrome = useCallback(() => setChromeVisible((visible) => !visible), []);
  // Mirror of the state for the scroll worklet, so it can skip the JS hop
  // entirely once the chrome is already hidden.
  const chromeShown = useSharedValue(1);
  useEffect(() => {
    chromeShown.value = chromeVisible ? 1 : 0;
  }, [chromeVisible, chromeShown]);

  // Scrolling *down* is the reader committing to the text, so the chrome tucks away. Scrolling
  // back up mid-article deliberately does not bring it back — that was the old sticky behaviour
  // and it kept fighting the reader. Returning all the way to the top does, though: at the top
  // you've left the text, and the header is what you came back for.
  useAnimatedReaction(
    () => scrollY.value,
    (current, previous) => {
      if (previous === null) return;
      if (
        chromeShown.value === 1 &&
        current > CHROME_AUTO_HIDE_AFTER &&
        current - previous > CHROME_AUTO_HIDE_TRAVEL
      ) {
        chromeShown.value = 0;
        runOnJS(setChromeVisible)(false);
        return;
      }
      if (chromeShown.value === 0 && current <= CHROME_REVEAL_AT_TOP && current < previous) {
        chromeShown.value = 1;
        runOnJS(setChromeVisible)(true);
      }
    }
  );

  const { checkAndTriggerUpgrade } = useLimitChecker();

  // Bottom sheet refs
  const summaryBottomSheetRef = useRef<SheetRef>(null);
  const languagePickerRef = useRef<SheetRef>(null);
  const optionsBottomSheetRef = useRef<SheetRef>(null);
  const readerSettingsRef = useRef<SheetRef>(null);
  const outlineSheetRef = useRef<SheetRef>(null);

  // Fetch article data
  const {
    data: article,
    isLoading: isArticleLoading,
    status: articleStatus,
  } = useArticle(articleId || '', {
    enabled: !!articleId,
    articleType,
  });

  // Only claim "not found" once the query has actually settled. A query that is
  // merely idle — cancelled, or waiting to be retried — has `isLoading === false`
  // with no data, and treating that as a miss showed "Article not found" over a
  // perfectly good article.
  const isArticleMissing = articleStatus === 'error' || (articleStatus === 'success' && !article);

  // Check if this is a clipped article (route param covers the loading state)
  const isClipped = (article?.article_type ?? articleType) === 'clipped';
  const showDone = isClipped || isReadLaterMode;

  // ============ View Mode State ============
  const [contentSource, setContentSource] = useState<ArticleViewMode>('original');
  const [userSelectedView, setUserSelectedView] = useState<ArticleViewMode | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string | null>(null);

  useEffect(() => {
    if (article?.id) void recordReviewActivity(article.id);
  }, [article?.id]);

  // ============ Extraction & Translation ============
  const extractMutation = useExtractFullTextMutation();
  const extractedData = extractMutation.data;
  const translateMutation = useTranslateArticleMutation();
  const translateData = translateMutation.data;
  const summarizeMutation = useSummarizeArticleMutation();
  const summaryData = summarizeMutation.data;
  const isSummaryLoading = summarizeMutation.isPending;
  const highlightMutation = useGenerateHighlightsMutation();
  const [highlightedFor, setHighlightedFor] = useState<ArticleViewMode | null>(null);
  const [highlightsEnabled, setHighlightsEnabled] = useState(false);

  const recentLanguages = useTranslationHistory((state) => state.recentLanguages);
  const addRecentLanguage = useTranslationHistory((state) => state.addRecentLanguage);
  const updateArticle = useUpdateArticle();

  // ============ Content Selection Logic ============
  const currentContent = useMemo(() => {
    switch (contentSource) {
      case 'extracted':
        // Priority: server-extracted → live-extracted → original
        return article?.extracted_content || extractedData?.content || article?.content;
      case 'original':
        // Priority: original → extracted → description (as fallback)
        return article?.content || article?.extracted_content || article?.description;
      default:
        return article?.content;
    }
  }, [
    contentSource,
    article?.content,
    article?.extracted_content,
    article?.description,
    extractedData?.content,
  ]);

  const activeContent =
    contentSource === 'translated' && translateData?.translated_content
      ? translateData.translated_content
      : currentContent;

  // User-initiated extraction only (tapping "Full Text"), so a spent quota surfaces the
  // paywall rather than failing quietly. Extraction on open is the server's job.
  const extractFullText = useCallback(async () => {
    return extractMutation.mutateAsync({
      articleId: articleId || '',
      articleUrl: article?.link || '',
    });
  }, [articleId, article?.link, extractMutation]);

  const generateSummary = useCallback(async () => {
    const languageKey =
      contentSource === 'translated' && targetLanguage ? targetLanguage : 'original';
    return summarizeMutation.mutateAsync({
      articleId: articleId || '',
      content: activeContent || undefined,
      languageKey,
    });
  }, [articleId, activeContent, contentSource, targetLanguage, summarizeMutation]);

  // ============ View Mode Effects ============
  // Initialize view based on available content
  useEffect(() => {
    setUserSelectedView(null);
    // Prefer server-side extracted content if available, otherwise show original
    setContentSource(article?.extracted_content ? 'extracted' : 'original');
  }, [articleId, article?.extracted_content]);

  // Auto-switch to extracted when extraction completes (only if user hasn't manually selected)
  useEffect(() => {
    const hasExtractedContent = !!extractedData?.content;
    const userHasNotSelected = userSelectedView === null;
    const isExtractionComplete = extractMutation.status === 'success';

    if (userHasNotSelected && isExtractionComplete && hasExtractedContent) {
      setContentSource('extracted');
    }
  }, [extractMutation.status, extractedData?.content, userSelectedView]);

  const sortedLanguages = useMemo(() => {
    // Put recent languages at the top, followed by the rest
    const recent = recentLanguages
      .map((code) => SUPPORTED_LANGUAGES.find((l) => l.value === code))
      .filter(Boolean) as LanguageOption[];

    const others = SUPPORTED_LANGUAGES.filter((l) => !recentLanguages.includes(l.value));
    return [...recent, ...others];
  }, [recentLanguages]);

  // No client-side auto-extraction: GET /articles/{id} already returns `extracted_content`
  // for articles whose feed content is only a teaser, and persists it so later opens are
  // served from the database. Firing a background extract here as well meant two scrapes
  // (and two quota charges) for a single open. Tapping "Full Text" still extracts on
  // demand via `extractFullText()` for anything the server chose not to extract.

  // Mark as read the moment the reader opens — in parallel with the detail
  // fetch, not after it.
  //
  // This used to wait for `article` to resolve. Opening an article and backing
  // out before the fetch finished meant the PATCH never fired, while the list
  // had already dimmed the card: the UI said "read", the server said "unread",
  // and the two only reconciled on the next refetch. Keying off `articleId`
  // (which we have immediately, from the route) removes that window entirely.
  //
  // The read state comes from whatever the cache already holds, so re-opening a
  // read article still costs nothing. An article that's in no cache at all
  // (deep link, cold start) is treated as unread — one idempotent PATCH is a
  // far better trade than a missed one.
  const markedReadForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!articleId || !isSubscribed) return;
    if (markedReadForRef.current === articleId) return;
    if (getCachedArticleState(queryClient, articleId)?.is_read) return;

    markedReadForRef.current = articleId;
    updateArticle.mutate({
      articleId,
      data: { is_read: true },
      // Rollback on failure is handled by the hook; there's nothing useful to
      // tell the reader about a background mark-as-read.
      articleType: articleType || 'feed',
    });
    // `updateArticle` is intentionally omitted: its identity churns with the
    // mutation's own state and the ref guard already makes this fire once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId, articleType, isSubscribed, queryClient]);

  // Refetch article list when navigating back to ensure updated state
  useFocusEffect(
    useCallback(() => {
      return () => {
        // When losing focus (navigating away), invalidate article lists
        queryClient.invalidateQueries({
          queryKey: ['rss-articles', 'infinite'],
        });
      };
    }, [queryClient])
  );

  // Handlers
  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleBookmark = useCallback(() => {
    if (!article) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newValue = !article.is_saved;
    updateArticle.mutate(
      {
        articleId: article.id,
        data: { is_saved: newValue },
        articleType: article.article_type || 'feed',
      },
      {
        onSuccess: () => {
          if (newValue) {
            toast.success('Article saved');
          } else {
            toast.success('Article removed from read later');
          }
        },
        onError: (error) => {
          // Plan limits (e.g. the free saved-articles cap) open the upgrade dialog globally
          if (isPaywallError(error)) return;
          toast.error(
            newValue ? 'Failed to save article' : 'Failed to remove article from read later'
          );
        },
      }
    );
  }, [article, updateArticle]);

  const handleMarkAsDone = useCallback(() => {
    if (!article) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Resolve the next saved article before the optimistic update drops this one from the list
    const nextArticle = isReadLaterMode
      ? getAdjacentArticle(queryClient.getQueryData(queryKeys.infiniteReadLater()), article.id)
      : undefined;

    // Like web: mark as read and remove from read later in one update
    toast
      .promise(
        updateArticle.mutateAsync({
          articleId: article.id,
          data: { is_read: true, is_saved: false },
          articleType: article.article_type || 'feed',
        }),
        {
          loading: 'Marking as done...',
          success: 'Marked as done',
          error: 'Failed to mark as done',
        }
      )
      .catch(() => {
        // Error toast shown above; the hook rolls back the optimistic update
      });

    if (nextArticle) {
      router.replace({
        pathname: '/(protected)/articles/[id]',
        params: {
          id: nextArticle.id,
          type: nextArticle.article_type,
          mode: READ_LATER_READER_MODE,
        },
      });
    } else {
      router.back();
    }
  }, [article, isReadLaterMode, queryClient, updateArticle, router]);

  const handleShare = useCallback(async () => {
    if (!article) return;
    try {
      await Share.share({
        message: `${article.title}\n\n${article.link}`,
        url: article.link,
        title: article.title ?? undefined,
      });
    } catch {
      toast.error('Failed to share article');
    }
  }, [article]);

  const handleCopyLink = useCallback(async () => {
    if (!article) return;
    try {
      await Clipboard.setStringAsync(article.link);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  }, [article]);

  const handleOpenInBrowser = useCallback(async () => {
    if (!article) return;
    try {
      const supported = await Linking.canOpenURL(article.link);
      if (supported) {
        await Linking.openURL(article.link);
      } else {
        toast.error('Cannot open this URL');
      }
    } catch {
      toast.error('Failed to open in browser');
    }
  }, [article]);

  const handleMenuPress = useCallback(() => {
    optionsBottomSheetRef.current?.present();
  }, []);

  const handleOpenSettings = useCallback(() => {
    readerSettingsRef.current?.present();
  }, []);

  const handleOpenOutline = useCallback(() => {
    outlineSheetRef.current?.present();
  }, []);

  const handleOutlineSelect = useCallback((item: OutlineItem) => {
    readerRef.current?.scrollToOutlineItem(item.top);
  }, []);

  const handleScrollToTop = useCallback(() => {
    readerRef.current?.scrollToTop();
  }, []);

  // Read Later advances in place via router.replace, so the screen is reused
  // for the next article and the previous article's outline has to be dropped.
  useEffect(() => {
    setOutline([]);
    setActiveSectionId(null);
    setChromeVisible(true);
  }, [articleId]);

  const handleGenerateSummary = useCallback(() => {
    if (!article) return;

    // Over the AI quota: the upgrade dialog is the only feedback — no sheet, no error toast
    if (!checkAndTriggerUpgrade('ai')) return;

    // Open bottom sheet immediately
    summaryBottomSheetRef.current?.present();

    // Generate summary
    generateSummary()
      .then(() => {
        // Success handled by the bottom sheet
      })
      .catch((error) => {
        console.error('Failed to generate summary:', error);
        summaryBottomSheetRef.current?.dismiss();
        // Plan limits open the upgrade dialog globally — don't stack an error toast on it
        if (isPaywallError(error)) return;
        toast.error('Failed to generate summary');
      });
  }, [article, generateSummary, checkAndTriggerUpgrade]);

  const handleRegenerateSummary = useCallback(() => {
    if (!article) return;

    if (!checkAndTriggerUpgrade('ai')) return;

    generateSummary()
      .then(() => {
        toast.success('Summary regenerated!');
      })
      .catch((error) => {
        console.error('Failed to regenerate summary:', error);
        if (isPaywallError(error)) return;
        toast.error('Failed to regenerate summary');
      });
  }, [article, generateSummary, checkAndTriggerUpgrade]);

  const handleTranslateSelect = useCallback(
    (language: string) => {
      if (!article) return;

      addRecentLanguage(language);
      setTargetLanguage(language);
      toast.info('Translating article...');

      translateMutation
        .mutateAsync({
          articleId: articleId || '',
          targetLanguage: language,
          content: currentContent || undefined,
          articleType: article?.article_type,
        })
        .then(() => {
          setContentSource('translated');
          toast.success('Translation complete!');
        })
        .catch((error) => {
          console.error('Failed to translate:', error);
          if (isPaywallError(error)) return;
          toast.error('Failed to translate article');
        });
    },
    [article, articleId, currentContent, addRecentLanguage, translateMutation]
  );

  const hasHighlightsForView = highlightedFor === contentSource;

  const handleGenerateHighlights = useCallback(() => {
    if (!article) return;

    if (hasHighlightsForView) {
      // Already generated for this view — just flip visibility, no re-fetch
      setHighlightsEnabled((prev) => !prev);
      return;
    }

    if (!checkAndTriggerUpgrade('ai')) return;

    toast.info('Generating highlights...');

    highlightMutation
      .mutateAsync({
        articleId: articleId || '',
        content: currentContent || undefined,
        languageKey: contentSource,
        articleType: article.article_type,
      })
      .then(() => {
        setHighlightedFor(contentSource);
        setHighlightsEnabled(true);
        toast.success('Highlights ready');
      })
      .catch((error) => {
        console.error('Failed to generate highlights:', error);
        if (isPaywallError(error)) return;
        toast.error('Failed to generate highlights');
      });
  }, [
    article,
    articleId,
    contentSource,
    currentContent,
    hasHighlightsForView,
    highlightMutation,
    checkAndTriggerUpgrade,
  ]);

  const handleSelectView = useCallback(
    (view: ArticleViewMode) => {
      // Mark user selection to prevent auto-switch effects
      setUserSelectedView(view);

      // For extracted view, check if we need to trigger extraction
      if (view === 'extracted') {
        const hasExtractedContent = !!article?.extracted_content || !!extractedData?.content;

        if (!hasExtractedContent) {
          // Extraction not available yet, trigger it
          toast.info('Extracting full text...');
          extractFullText()
            .then(() => {
              setContentSource('extracted');
              toast.success('Full text extracted!');
            })
            .catch((error) => {
              if (isPaywallError(error)) return;
              toast.error('Failed to extract text');
            });
        } else {
          // Extracted content available, show it immediately
          setContentSource('extracted');
          toast.success('Showing full text');
        }
      } else {
        // For original or translated, just switch the view
        setContentSource(view);
        const messages = {
          original: 'Showing original content',
          translated: 'Showing translated content',
        };
        toast.success(messages[view] || 'View changed');
      }
    },
    [article?.extracted_content, extractedData?.content, extractFullText]
  );

  if (isArticleMissing) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <ArticleActionBar
          onClose={handleClose}
          onShare={handleShare}
          onBookmark={handleBookmark}
          onMenuPress={() => {}}
          isBookmarked={false}
          isClipped={false}
          colors={colors}
        />
        <View className="flex-1 items-center justify-center px-6">
          <Text size="base" fontFamily="geist" className="text-grey text-center">
            Article not found
          </Text>
        </View>
      </View>
    );
  }

  const isExtracting = article
    ? article.article_type === 'feed' &&
      !article.extracted_content &&
      !article.link?.startsWith('newsletter://') &&
      extractMutation.isPending
    : false;

  const isNewsletter =
    !!article?.link?.startsWith('newsletter://') ||
    (article as any)?.feed_type === 'newsletter' ||
    (article as any)?.article_type === 'newsletter';

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <ArticleActionBar
        visible={chromeVisible}
        onClose={handleClose}
        onShare={handleShare}
        onBookmark={showDone ? handleMarkAsDone : handleBookmark}
        onMenuPress={isArticleLoading ? () => {} : handleMenuPress}
        hideMenu={isNewsletter}
        onGenerateSummary={isArticleLoading ? undefined : handleGenerateSummary}
        onCopyLink={isArticleLoading ? undefined : handleCopyLink}
        isBookmarked={article?.is_saved || false}
        isClipped={isClipped}
        showDone={showDone}
        colors={colors}
      />

      {articleStatus === 'pending' || translateMutation.isPending ? (
        <Animated.View key="skeleton-view" exiting={FadeOut.duration(300)} className="flex-1">
          <ArticleReaderSkeleton article={article} />
        </Animated.View>
      ) : (
        <Animated.View key="content-view" entering={FadeIn.duration(400)} className="flex-1">
          {article && (
            <ArticleReader
              ref={readerRef}
              article={{
                ...article,
                // Override content with active content
                content: activeContent || article.content,
                // Override title, description and tags when translated
                title:
                  contentSource === 'translated' && translateData?.translated_title
                    ? translateData.translated_title
                    : article.title,
                description:
                  contentSource === 'translated' && translateData?.translated_description
                    ? translateData.translated_description
                    : article.description,
                tags:
                  contentSource === 'translated' && translateData?.translated_tags
                    ? translateData.translated_tags
                    : article.tags,
              }}
              scrollY={scrollY}
              lastScrollY={lastScrollY}
              scrollDirection={scrollDirection}
              readingProgress={readingProgress}
              onOutlineChange={setOutline}
              onActiveOutlineChange={setActiveSectionId}
              onTap={handleToggleChrome}
              isLoadingContent={isExtracting}
              highlightedContent={
                hasHighlightsForView ? highlightMutation.data?.highlighted_content : undefined
              }
              highlightsEnabled={highlightsEnabled && hasHighlightsForView}
            />
          )}
        </Animated.View>
      )}

      {/* Bottom chrome: reading position + the corner menu. Withheld while a
          skeleton is up — a progress ring over a skeleton reports on nothing. */}
      {article && !translateMutation.isPending && (
        <ReaderBottomBar
          visible={chromeVisible}
          readingProgress={readingProgress}
          activeSectionLabel={activeSectionLabel}
          colors={colors}
          onOpenSettings={handleOpenSettings}
          onScrollToTop={handleScrollToTop}
          onOpenOutline={hasOutline ? handleOpenOutline : undefined}
          skim={
            isNewsletter
              ? undefined
              : {
                  active: highlightsEnabled && hasHighlightsForView,
                  generating: highlightMutation.isPending,
                  onPress: handleGenerateHighlights,
                }
          }
          onTranslate={() => languagePickerRef.current?.present()}
        />
      )}

      {/* Reader typography */}
      <ReaderSettingsBottomSheet ref={readerSettingsRef} />

      {/* Article outline */}
      <ArticleOutlineBottomSheet
        ref={outlineSheetRef}
        outline={outline}
        onSelect={handleOutlineSelect}
      />

      {/* AI Summary Bottom Sheet */}
      <ArticleSummaryBottomSheet
        ref={summaryBottomSheetRef}
        summary={summaryData || null}
        error={summarizeMutation.error ? String(summarizeMutation.error) : null}
        isLoading={isSummaryLoading}
        onRegenerate={handleRegenerateSummary}
      />

      {/* Language Picker Bottom Sheet */}
      <LanguagePicker
        ref={languagePickerRef}
        languages={sortedLanguages}
        title="Translate to..."
        initialLanguage={targetLanguage || undefined}
        onLanguageChange={handleTranslateSelect}
      />

      {/* Options Bottom Sheet */}
      <ArticleOptionsBottomSheet
        ref={optionsBottomSheetRef}
        currentView={contentSource}
        onSelectView={handleSelectView}
        onTranslate={() => languagePickerRef.current?.present()}
        onOpenInBrowser={isArticleLoading ? undefined : handleOpenInBrowser}
        hasExtractedContent={!!article?.extracted_content || !!extractedData?.content}
        hasTranslatedContent={!!translateData?.translated_content}
        canExtractContent={true}
        isClipped={isClipped}
        isNewsletter={isNewsletter}
      />
    </View>
  );
}
