import {
  ArticleOptionsBottomSheet,
  type ArticleViewMode,
} from '@components/bottom-sheets/article-options';
import { ArticleSummaryBottomSheet } from '@components/bottom-sheets/article-summary';
import MenuDotsBoldIcon from '@components/icons/solar/menu-dots-bold';
import { ArticleReader } from '@components/screens/article-reader/index';
import { ArticleActionBar } from '@components/screens/article-reader/ui/article-actions.bar';
import { ArticleReaderSkeleton } from '@components/screens/article-reader/ui/article-reader.skeleton';
import type { LanguageOption } from '@components/screens/discover/ui/language-picker.dropdown';
import { LanguagePicker } from '@components/screens/discover/ui/language-picker.dropdown';
import { Button } from '@components/ui/button';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { SUPPORTED_LANGUAGES } from '@lib/constants/languages';
import {
  useArticle,
  useExtractFullTextMutation,
  useSummarizeArticleMutation,
  useTranslateArticleMutation,
  useUpdateArticle,
} from '@readspace/shared';
import { useTranslationHistory } from '@stores/translation-history';
import { useQueryClient } from '@tanstack/react-query';
import { useLimitChecker } from '@hooks/useLimitChecker';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Linking, Share, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

interface ArticleScreenProps {
  articleId: string;
  isSubscribed?: boolean;
}

export function ArticleScreen({ articleId, isSubscribed = true }: ArticleScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const scrollY = useSharedValue(0);
  const lastScrollY = useSharedValue(0);
  const scrollDirection = useSharedValue<'up' | 'down'>('down');
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const { checkAndTriggerUpgrade } = useLimitChecker();

  // Bottom sheet refs
  const summaryBottomSheetRef = useRef<BottomSheetModal>(null);
  const languagePickerRef = useRef<BottomSheetModal>(null);
  const optionsBottomSheetRef = useRef<BottomSheetModal>(null);

  // Fetch article data
  const { data: article, isLoading: isArticleLoading } = useArticle(articleId || '', {
    enabled: !!articleId,
  });

  // Check if this is a clipped article
  const isClipped = article?.article_type === 'clipped';

  // Content source state - prefer extracted content when available
  const [contentSource, setContentSource] = useState<ArticleViewMode>(
    article?.extracted_content ? 'extracted' : 'original'
  );

  const [targetLanguage, setTargetLanguage] = useState<string | null>(null);

  const recentLanguages = useTranslationHistory((state) => state.recentLanguages);
  const addRecentLanguage = useTranslationHistory((state) => state.addRecentLanguage);

  const updateArticle = useUpdateArticle();

  // Extract full text hook - auto-trigger for articles without extracted content
  const extractMutation = useExtractFullTextMutation();
  const extractedData = extractMutation.data;
  const extractFullText = useCallback(async () => {
    return extractMutation.mutateAsync({
      articleId: articleId || '',
      articleUrl: article?.link || '',
    });
  }, [articleId, article?.link, extractMutation]);

  // Get the current content based on source
  const currentContent =
    contentSource === 'extracted' && (article?.extracted_content || extractedData?.content)
      ? article?.extracted_content || extractedData?.content
      : article?.content;

  const translateMutation = useTranslateArticleMutation();
  const translateData = translateMutation.data;

  const activeContent =
    contentSource === 'translated' && translateData?.translated_content
      ? translateData.translated_content
      : currentContent;

  // AI Summary hooks
  const summarizeMutation = useSummarizeArticleMutation();
  const summaryData = summarizeMutation.data;
  const isSummaryLoading = summarizeMutation.isPending;
  const generateSummary = useCallback(async () => {
    if (!checkAndTriggerUpgrade('ai')) {
      throw new Error('AI limit reached');
    }
    return summarizeMutation.mutateAsync({
      articleId: articleId || '',
      content: currentContent || undefined,
      languageKey: contentSource,
    });
  }, [articleId, currentContent, contentSource, summarizeMutation, checkAndTriggerUpgrade]);

  // Sync contentSource with article.extracted_content
  useLayoutEffect(() => {
    setContentSource(article?.extracted_content ? 'extracted' : 'original');
  }, [article?.extracted_content]);

  const sortedLanguages = useMemo(() => {
    // Put recent languages at the top, followed by the rest
    const recent = recentLanguages
      .map((code) => SUPPORTED_LANGUAGES.find((l) => l.value === code))
      .filter(Boolean) as LanguageOption[];

    const others = SUPPORTED_LANGUAGES.filter((l) => !recentLanguages.includes(l.value));
    return [...recent, ...others];
  }, [recentLanguages]);

  // Auto-extract content if not already extracted and article has loaded (only if subscribed)
  useEffect(() => {
    if (
      isSubscribed &&
      article &&
      !article.extracted_content &&
      article.article_type === 'feed' &&
      article.link &&
      extractMutation.status === 'idle'
    ) {
      // Trigger extraction automatically
      extractFullText().catch((error) => {
        console.warn('Failed to auto-extract article content:', error);
      });
    }
  }, [article, extractMutation.status, extractFullText, isSubscribed]);

  // Mark as read on mount (only if subscribed to the feed)
  useEffect(() => {
    if (article && !article.is_read && isSubscribed) {
      updateArticle.mutate(
        {
          articleId: article.id,
          data: { is_read: true },
          articleType: article.article_type || 'feed',
        },
        {
          // Silently mark as read - optimistic update handles UI
          onError: () => {
            // Rollback already handled by the hook
          },
        }
      );
    }
  }, [article, isSubscribed, updateArticle]);

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
        onError: () => {
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

    // Show immediate feedback
    toast.success('Marked as done');

    updateArticle.mutate(
      {
        articleId: article.id,
        data: { is_saved: false },
        articleType: article.article_type || 'feed',
      },
      {
        onSuccess: () => {
          router.back();
        },
        onError: () => {
          toast.error('Failed to mark as done');
        },
      }
    );
  }, [article, updateArticle, router]);

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

  const handleGenerateSummary = useCallback(() => {
    if (!article) return;

    // Show loading toast
    toast.info('Generating AI summary...');

    // Open bottom sheet immediately
    summaryBottomSheetRef.current?.present();

    // Generate summary
    generateSummary()
      .then(() => {
        // Success handled by the bottom sheet
      })
      .catch((error) => {
        console.error('Failed to generate summary:', error);
        toast.error('Failed to generate summary');
        summaryBottomSheetRef.current?.dismiss();
      });
  }, [article, generateSummary]);

  const handleRegenerateSummary = useCallback(() => {
    if (!article) return;

    toast.info('Regenerating summary...');

    generateSummary()
      .then(() => {
        toast.success('Summary regenerated!');
      })
      .catch((error) => {
        console.error('Failed to regenerate summary:', error);
        toast.error('Failed to regenerate summary');
      });
  }, [article, generateSummary]);

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
          toast.error('Failed to translate article');
        });
    },
    [article, articleId, currentContent, addRecentLanguage, translateMutation]
  );

  const handleSelectView = useCallback(
    (view: ArticleViewMode) => {
      if (view === 'extracted' && !(article?.extracted_content || extractedData?.content)) {
        toast.info('Extracting full text...');
        extractFullText()
          .then(() => {
            setContentSource('extracted');
            toast.success('Full text extracted!');
          })
          .catch(() => {
            toast.error('Failed to extract text');
          });
      } else {
        setContentSource(view);
        if (view === 'original') toast.success('Showing original content');
        if (view === 'extracted') toast.success('Showing extracted content');
      }
    },
    [article, extractedData, extractFullText]
  );

  if (isArticleLoading) {
    return (
      <View className="bg-background flex-1">
        <ArticleActionBar
          onClose={handleClose}
          onShare={handleShare}
          onBookmark={handleBookmark}
          onMenuPress={() => {}}
          isBookmarked={false}
          isClipped={false}
        />
        <ArticleReaderSkeleton article={article} />
      </View>
    );
  }

  if (!article) {
    return (
      <View className="bg-background flex-1">
        <ArticleActionBar
          onClose={handleClose}
          onShare={handleShare}
          onBookmark={handleBookmark}
          onMenuPress={() => {}}
          isBookmarked={false}
          isClipped={false}
        />
        <View className="flex-1 items-center justify-center px-6">
          <Text size="base" fontFamily="geist" className="text-grey text-center">
            Article not found
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="bg-background flex-1">
      <ArticleActionBar
        scrollY={scrollY}
        scrollDirection={scrollDirection}
        onClose={handleClose}
        onShare={handleShare}
        onBookmark={isClipped ? handleMarkAsDone : handleBookmark}
        onMenuPress={handleMenuPress}
        isBookmarked={article.is_saved || false}
        isClipped={isClipped}
      />
      <ArticleReader
        article={{
          ...article,
          // Override content with active content
          content: activeContent || article.content,
        }}
        scrollY={scrollY}
        lastScrollY={lastScrollY}
        scrollDirection={scrollDirection}
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
        onGenerateSummary={handleGenerateSummary}
        onCopyLink={handleCopyLink}
        onOpenInBrowser={handleOpenInBrowser}
        hasExtractedContent={!!article?.extracted_content || !!extractedData?.content}
        hasTranslatedContent={!!translateData?.translated_content}
        canExtractContent={isSubscribed || false}
        isClipped={isClipped}
        isSubscribed={isSubscribed}
      />
    </View>
  );
}
