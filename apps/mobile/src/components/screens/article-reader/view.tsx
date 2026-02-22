import { ArticleSummaryBottomSheet } from '@components/bottom-sheets/article-summary';
import { ArticleReader } from '@components/screens/article-reader/index';
import { ArticleActionBar } from '@components/screens/article-reader/ui/article-actions.bar';
import { ArticleReaderSkeleton } from '@components/screens/article-reader/ui/article-reader.skeleton';
import { Button } from '@components/ui/button';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIcon,
  DropdownMenuItemTitle,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { Monicon } from '@monicon/native';
import {
  useArticle,
  useExtractFullTextMutation,
  useSummarizeArticleMutation,
  useUpdateArticle,
} from '@readspace/shared';
import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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

  // Bottom sheet refs
  const summaryBottomSheetRef = useRef<BottomSheetModal>(null);

  // Fetch article data
  const { data: article, isLoading: isArticleLoading } = useArticle(articleId || '', {
    enabled: !!articleId,
  });

  // Check if this is a clipped article
  const isClipped = article?.article_type === 'clipped';

  // Content source state - prefer extracted content when available
  const [contentSource, setContentSource] = useState<'original' | 'extracted'>(
    article?.extracted_content ? 'extracted' : 'original'
  );

  const updateArticle = useUpdateArticle();

  // Extract full text hook - auto-trigger for articles without extracted content
  const extractMutation = useExtractFullTextMutation();
  const extractedData = extractMutation.data;
  const extractFullText = useCallback(async () => {
    return extractMutation.mutateAsync({
      articleId: articleId || '',
      articleUrl: article?.link || ''
    });
  }, [articleId, article?.link, extractMutation]);

  // Get the current content based on source
  const currentContent =
    contentSource === 'extracted' && (article?.extracted_content || extractedData?.content)
      ? article?.extracted_content || extractedData?.content
      : article?.content;

  // AI Summary hooks
  const summarizeMutation = useSummarizeArticleMutation();
  const summaryData = summarizeMutation.data;
  const isSummaryLoading = summarizeMutation.isPending;
  const generateSummary = useCallback(async () => {
    return summarizeMutation.mutateAsync({
      articleId: articleId || '',
      content: currentContent || undefined
    });
  }, [articleId, currentContent, summarizeMutation]);

  // Sync contentSource with article.extracted_content
  useLayoutEffect(() => {
    setContentSource(article?.extracted_content ? 'extracted' : 'original');
  }, [article?.extracted_content]);

  // Auto-extract content if not already extracted and article has loaded
  useEffect(() => {
    if (
      article &&
      !article.extracted_content &&
      article.article_type === 'feed' &&
      article.link &&
      !extractedData
    ) {
      // Trigger extraction automatically
      extractFullText().catch((error) => {
        console.warn('Failed to auto-extract article content:', error);
      });
    }
  }, [article, extractedData, extractFullText]);

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
    // The dropdown menu will handle opening/closing
    // This is just a placeholder for the action bar
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

  if (isArticleLoading) {
    return (
      <View className="flex-1 bg-background dark:bg-background-dark">
        <ArticleActionBar
          onClose={handleClose}
          onShare={handleShare}
          onBookmark={handleBookmark}
          onMenuPress={() => { }}
          isBookmarked={false}
          isClipped={false}
        />
        <ArticleReaderSkeleton article={article} />
      </View>
    );
  }

  if (!article) {
    return (
      <View className="flex-1 bg-background dark:bg-background-dark">
        <ArticleActionBar
          onClose={handleClose}
          onShare={handleShare}
          onBookmark={handleBookmark}
          onMenuPress={() => { }}
          isBookmarked={false}
          isClipped={false}
        />
        <View className="flex-1 items-center justify-center px-6">
          <Text
            size="base"
            fontFamily="geist"
            className="text-center text-grey dark:text-grey-dark">
            Article not found
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <ArticleActionBar
        scrollY={scrollY}
        scrollDirection={scrollDirection}
        onClose={handleClose}
        onShare={handleShare}
        onBookmark={isClipped ? handleMarkAsDone : handleBookmark}
        onMenuPress={handleMenuPress}
        isBookmarked={article.is_saved || false}
        isClipped={isClipped}
        menuTrigger={
          <DropdownMenuRoot>
            <DropdownMenuTrigger asChild>
              <Button variant="icon" size="small" fullWidth={false} className="h-11 w-11">
                <View style={{ transform: [{ rotate: '90deg' }] }}>
                  <Monicon
                    name="solar:menu-dots-bold"
                    size={18}
                    strokeWidth={2.4}
                    color={colors.grey}
                  />
                </View>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem key="copy-link" onSelect={handleCopyLink}>
                <DropdownMenuItemIcon ios={{ name: 'link' }} androidIconName="link" />
                <DropdownMenuItemTitle>Copy Link</DropdownMenuItemTitle>
              </DropdownMenuItem>
              <DropdownMenuItem key="open-browser" onSelect={handleOpenInBrowser}>
                <DropdownMenuItemIcon ios={{ name: 'safari' }} androidIconName="open_in_browser" />
                <DropdownMenuItemTitle>Open in Browser</DropdownMenuItemTitle>
              </DropdownMenuItem>
              {isClipped && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem key="mark-done" onSelect={handleMarkAsDone}>
                    <DropdownMenuItemIcon
                      ios={{ name: 'checkmark.circle.fill' }}
                      androidIconName="check_circle"
                    />
                    <DropdownMenuItemTitle>Mark as Done</DropdownMenuItemTitle>
                  </DropdownMenuItem>
                </>
              )}
              {isSubscribed && !isClipped && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    key="extract"
                    onSelect={() => {
                      if (contentSource === 'extracted') {
                        setContentSource('original');
                        toast.success('Showing original content');
                      } else if (article?.extracted_content || extractedData?.content) {
                        setContentSource('extracted');
                        toast.success('Showing extracted content');
                      } else {
                        toast.info('Extracting full text...');
                        extractFullText()
                          .then(() => {
                            setContentSource('extracted');
                            toast.success('Full text extracted!');
                          })
                          .catch(() => {
                            toast.error('Failed to extract text');
                          });
                      }
                    }}>
                    <DropdownMenuItemIcon ios={{ name: 'doc.text' }} androidIconName="article" />
                    <DropdownMenuItemTitle>
                      {contentSource === 'extracted' ? 'Show Original' : 'Extract Full Text'}
                    </DropdownMenuItemTitle>
                  </DropdownMenuItem>
                  <DropdownMenuItem key="summarize" onSelect={handleGenerateSummary}>
                    <DropdownMenuItemIcon
                      ios={{ name: 'note.text' }}
                      androidIconName="description"
                    />
                    <DropdownMenuItemTitle>Generate Summary</DropdownMenuItemTitle>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    key="translate"
                    onSelect={() => {
                      toast.info('Translate feature coming soon');
                    }}>
                    <DropdownMenuItemIcon ios={{ name: 'globe' }} androidIconName="translate" />
                    <DropdownMenuItemTitle>Translate</DropdownMenuItemTitle>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenuRoot>
        }
      />
      <ArticleReader
        article={{
          ...article,
          // Override content with extracted content when available and selected
          content:
            contentSource === 'extracted' && (article.extracted_content || extractedData?.content)
              ? article.extracted_content || extractedData?.content || article.content
              : article.content,
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
    </View>
  );
}
