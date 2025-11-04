import { ArticleMenuModal } from '@/components/ArticleMenuModal';
import { ArticleReader } from '@/components/ArticleReader';
import { ArticleReaderSkeleton } from '@/components/skeletons';
import { COLORS } from '@/constants/Colors';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Monicon } from '@monicon/native';
import {
    fetchTranslation,
    useArticle,
    useExtractFullText,
    useSummarizeArticle,
    useUpdateArticle,
} from '@readspace/shared';
import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Linking, Pressable, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

export default function ArticleScreen() {
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const colors = COLORS[colorScheme ?? 'light'];
    const { id, isSubscribed: isSubscribedParam } = useLocalSearchParams<{
        id: string;
        isSubscribed?: string;
    }>();

    // Parse subscription status from URL param (default to true if not provided)
    const isSubscribed = isSubscribedParam === 'false' ? false : true;
    const menuModalRef = useRef<BottomSheetModal>(null);
    const queryClient = useQueryClient();

    // State
    const [translatedContent, setTranslatedContent] = useState<string | null>(null);
    const [aiSummary, setAiSummary] = useState<string | undefined>(undefined);
    const [isTranslating, setIsTranslating] = useState(false);

    // Fetch article data
    const { data: article, isLoading: isArticleLoading } = useArticle(id || '', {
        enabled: !!id,
    });

    // Check if this is a clipped article
    const isClipped = article?.article_type === 'clipped';

    const [contentSource, setContentSource] = useState<'original' | 'extracted' | 'translated'>(
        article?.extracted_content ? 'extracted' : 'original'
    );

    const updateArticle = useUpdateArticle();

    // Extract full text hook (manual trigger)
    const {
        refetch: extractFullText,
        data: extractedData,
        isFetching: isExtracting,
    } = useExtractFullText(id || '', article?.link || '');

    // Summarize hook (manual trigger)
    const {
        refetch: generateSummary,
        data: summaryData,
        isFetching: isSummarizing,
    } = useSummarizeArticle(
        id || '',
        contentSource === 'extracted' && (article?.extracted_content || extractedData?.content)
            ? (article?.extracted_content || extractedData?.content) || undefined
            : contentSource === 'translated' && translatedContent
                ? translatedContent
                : article?.content || undefined
    );

    // Sync contentSource with article.extracted_content (use useLayoutEffect to prevent flicker)
    useLayoutEffect(() => {
        setContentSource(article?.extracted_content ? 'extracted' : 'original');
        setTranslatedContent(null);
    }, [article?.id, article?.extracted_content]);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [article?.id, isSubscribed]);

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

        const newValue = !article.is_read_later;
        updateArticle.mutate(
            {
                articleId: article.id,
                data: { is_read_later: newValue },
                articleType: article.article_type || 'feed',
            },
            {
                // UI icon changes immediately, no toast needed
            }
        );
    }, [article, updateArticle]);

    const handleMarkAsDone = useCallback(() => {
        if (!article) return;

        // Show immediate feedback
        toast('Marked as done');

        updateArticle.mutate(
            {
                articleId: article.id,
                data: { is_read_later: false },
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

    const handleMenuPress = useCallback(() => {
        menuModalRef.current?.present();
    }, []);

    const handleCopyLink = useCallback(async () => {
        if (!article) return;
        await Clipboard.setStringAsync(article.link);
        toast('Link copied to clipboard');
    }, [article]);

    const handleOpenInBrowser = useCallback(async () => {
        if (!article) return;
        const supported = await Linking.canOpenURL(article.link);
        if (supported) {
            await Linking.openURL(article.link);
        } else {
            toast.error('Cannot open this URL');
        }
    }, [article]);

    const handleShare = useCallback(async () => {
        if (!article) return;
        try {
            await Share.share({
                message: `${article.title}\n\n${article.link}`,
                url: article.link,
                title: article.title,
            });
        } catch (error) {
            toast.error('Failed to share article');
        }
    }, [article]);

    const handleSummarize = useCallback(async () => {
        if (aiSummary) {
            // Summary already exists, button should be disabled instead
            return;
        }

        menuModalRef.current?.dismiss();
        toast.loading('Generating summary...', { id: 'summary' });

        try {
            const result = await generateSummary();
            if (result.data?.summary) {
                setAiSummary(result.data.summary);
                toast.success('Summary generated!', { id: 'summary' });
            } else {
                toast.error('Failed to generate summary', { id: 'summary' });
            }
        } catch {
            toast.error('Failed to generate summary', { id: 'summary' });
        }
    }, [aiSummary, generateSummary]);

    const handleCloseSummary = useCallback(() => {
        setAiSummary(undefined);
    }, []);

    const handleTranslate = useCallback(async (languageCode: string) => {
        if (!article) return;

        menuModalRef.current?.dismiss();
        setIsTranslating(true);
        toast.loading('Translating article...', { id: 'translate' });

        try {
            const currentContent =
                contentSource === 'extracted' && (article.extracted_content || extractedData?.content)
                    ? (article.extracted_content || extractedData?.content)
                    : article.content;

            const result = await fetchTranslation(
                queryClient,
                article.id,
                languageCode,
                currentContent || undefined
            );

            if (result.translated_content) {
                setTranslatedContent(result.translated_content);
                setContentSource('translated');
                toast.success('Article translated!', { id: 'translate' });
            } else {
                toast.error('Translation failed', { id: 'translate' });
            }
        } catch {
            toast.error('Failed to translate article', { id: 'translate' });
        } finally {
            setIsTranslating(false);
        }
    }, [article, contentSource, extractedData, queryClient]);

    const handleWebModeChange = useCallback(
        async (enabled: boolean) => {
            if (enabled) {
                // Check if we already have extracted content from API
                if (article?.extracted_content) {
                    setContentSource('extracted');
                    // Content switches immediately, no toast needed
                    return;
                }

                // Otherwise, manually extract full text
                toast.loading('Extracting full text...', { id: 'extract' });
                try {
                    const result = await extractFullText();
                    if (result.data?.content) {
                        setContentSource('extracted');
                        toast.success('Full text extracted!', { id: 'extract' });
                    } else {
                        toast.error('Failed to extract full text', { id: 'extract' });
                    }
                } catch {
                    toast.error('Failed to extract full text', { id: 'extract' });
                }
            } else {
                setContentSource('original');
                // Content switches immediately, no toast needed
            }
        },
        [article?.extracted_content, extractFullText]
    );

    // Get the current content to display
    const displayContent =
        contentSource === 'extracted' && (article?.extracted_content || extractedData?.content)
            ? (article?.extracted_content || extractedData?.content) || ''
            : contentSource === 'translated' && translatedContent
                ? translatedContent
                : article?.content || '';

    if (isArticleLoading) {
        return (
            <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-white-dark">
                {/* Top Action Bar Skeleton */}
                <View className="flex-row items-center justify-between border-b border-light-grey dark:border-light-grey-dark px-4 py-3">
                    <View className="h-11 w-11 rounded-full bg-mid-grey dark:bg-mid-grey-dark" />
                    <View className="flex-row items-center gap-3">
                        <View className="h-11 w-11 rounded-full bg-mid-grey dark:bg-mid-grey-dark" />
                        <View className="h-11 w-11 rounded-full bg-mid-grey dark:bg-mid-grey-dark" />
                        <View className="h-11 w-11 rounded-full bg-mid-grey dark:bg-mid-grey-dark" />
                    </View>
                </View>
                <ArticleReaderSkeleton />
            </SafeAreaView>
        );
    }

    if (!article) {
        return (
            <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-white-dark">
                <View className="flex-1 items-center justify-center px-6">
                    <Text className="text-center text-base text-grey dark:text-grey-dark">Article not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-white-dark">
            {/* Top Action Bar */}
            <View className="flex-row items-center justify-between border-b border-light-grey dark:border-light-grey-dark px-4 py-3">
                {/* Close Button */}
                <Pressable
                    onPress={handleClose}
                    className="h-11 w-11 items-center justify-center rounded-full active:bg-mid-grey dark:active:bg-mid-grey-dark">
                    <Monicon name="lucide:x" size={20} color={colors.black} />
                </Pressable>

                {/* Right Actions */}
                <View className="flex-row items-center gap-3">
                    {/* Share Button */}
                    <Pressable
                        onPress={handleShare}
                        className="h-11 w-11 items-center justify-center rounded-full active:bg-mid-grey dark:active:bg-mid-grey-dark">
                        <Monicon name="solar:share-outline" size={20} color={colors.black} />
                    </Pressable>

                    {/* Bookmark Button (or Done button for clipped articles) */}
                    <Pressable
                        onPress={isClipped ? handleMarkAsDone : handleBookmark}
                        className="h-11 w-11 items-center justify-center rounded-full active:bg-mid-grey dark:active:bg-mid-grey-dark">
                        <Monicon
                            name={
                                isClipped
                                    ? 'solar:check-circle-bold'
                                    : article.is_read_later
                                        ? 'solar:bookmark-bold'
                                        : 'solar:bookmark-linear'
                            }
                            size={20}
                            color={isClipped ? '#6A994E' : article.is_read_later ? '#FBBC04' : colors.black}
                        />
                    </Pressable>

                    {/* Menu Button */}
                    <Pressable
                        onPress={handleMenuPress}
                        className="h-11 w-11 items-center justify-center rounded-full active:bg-mid-grey dark:active:bg-mid-grey-dark">
                        <View style={{ transform: [{ rotate: '90deg' }] }}>
                            <Monicon name="solar:menu-dots-bold" size={20} color={colors.black} />
                        </View>
                    </Pressable>
                </View>
            </View>

            {/* Article Content with AI Features */}
            <ArticleReader
                article={{
                    ...article,
                    content: displayContent,
                }}
                aiSummary={aiSummary}
                isLoadingSummary={isSummarizing}
                onCloseSummary={handleCloseSummary}
            />

            {/* Menu Modal */}
            <ArticleMenuModal
                ref={menuModalRef}
                onCopyLink={handleCopyLink}
                onOpenInBrowser={handleOpenInBrowser}
                onSummarize={handleSummarize}
                onTranslate={handleTranslate}
                onWebModeChange={handleWebModeChange}
                webModeEnabled={contentSource === 'extracted'}
                isSubscribed={isSubscribed}
                isClipped={isClipped}
                onMarkAsDone={handleMarkAsDone}
            />
        </SafeAreaView>
    );
}
