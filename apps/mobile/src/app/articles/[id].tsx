import { ArticleMenuModal } from '@/components/ArticleMenuModal';
import { ArticleReader } from '@/components/ArticleReader';
import { ArticleReaderSkeleton } from '@/components/skeletons';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

export default function ArticleScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const menuModalRef = useRef<BottomSheetModal>(null);
    const queryClient = useQueryClient();

    // State
    const [contentSource, setContentSource] = useState<'original' | 'extracted' | 'translated'>(
        'original'
    );
    const [translatedContent, setTranslatedContent] = useState<string | null>(null);
    const [aiSummary, setAiSummary] = useState<string | undefined>(undefined);
    const [isTranslating, setIsTranslating] = useState(false);

    // Fetch article data
    const { data: article, isLoading: isArticleLoading } = useArticle(id || '', {
        enabled: !!id,
    });

    // Auto-detect extracted content from API
    useEffect(() => {
        if (article?.extracted_content) {
            setContentSource('extracted');
        }
    }, [article?.extracted_content]);

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

    // Mark as read on mount
    useEffect(() => {
        if (article && !article.is_read) {
            updateArticle.mutate({
                articleId: article.id,
                data: { is_read: true },
                articleType: 'feed',
            });
        }
    }, [article?.id]);

    // Handlers
    const handleClose = useCallback(() => {
        router.back();
    }, [router]);

    const handleBookmark = useCallback(() => {
        if (!article) return;

        const newValue = !article.is_read_later;
        updateArticle.mutate({
            articleId: article.id,
            data: { is_read_later: newValue },
            articleType: 'feed',
        });
        toast(newValue ? 'Saved for later' : 'Removed from saved');
    }, [article, updateArticle]);

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
            toast('Summary already generated');
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
        } catch (error) {
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
        } catch (error) {
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
                    toast('Showing extracted content');
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
                } catch (error) {
                    toast.error('Failed to extract full text', { id: 'extract' });
                }
            } else {
                setContentSource('original');
                toast('Showing original content');
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
            <SafeAreaView edges={['top']} className="flex-1 bg-white">
                {/* Top Action Bar Skeleton */}
                <View className="flex-row items-center justify-between border-b border-light-grey px-4 py-3">
                    <View className="h-11 w-11 rounded-full bg-mid-grey" />
                    <View className="flex-row items-center gap-3">
                        <View className="h-11 w-11 rounded-full bg-mid-grey" />
                        <View className="h-11 w-11 rounded-full bg-mid-grey" />
                        <View className="h-11 w-11 rounded-full bg-mid-grey" />
                    </View>
                </View>
                <ArticleReaderSkeleton />
            </SafeAreaView>
        );
    }

    if (!article) {
        return (
            <SafeAreaView edges={['top']} className="flex-1 bg-white">
                <View className="flex-1 items-center justify-center px-6">
                    <Text className="text-center text-base text-grey">Article not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-white">
            {/* Top Action Bar */}
            <View className="flex-row items-center justify-between border-b border-light-grey px-4 py-3">
                {/* Close Button */}
                <Pressable
                    onPress={handleClose}
                    className="h-11 w-11 items-center justify-center rounded-full active:bg-mid-grey">
                    <Monicon name="lucide:x" size={20} color="#232222" />
                </Pressable>

                {/* Right Actions */}
                <View className="flex-row items-center gap-3">
                    {/* Share Button */}
                    <Pressable
                        onPress={handleShare}
                        className="h-11 w-11 items-center justify-center rounded-full active:bg-mid-grey">
                        <Monicon name="solar:share-outline" size={20} color="#232222" />
                    </Pressable>

                    {/* Bookmark Button */}
                    <Pressable
                        onPress={handleBookmark}
                        className="h-11 w-11 items-center justify-center rounded-full active:bg-mid-grey">
                        <Monicon
                            name={
                                article.is_read_later
                                    ? 'solar:bookmark-bold'
                                    : 'solar:bookmark-linear'
                            }
                            size={20}
                            color={article.is_read_later ? '#FBBC04' : '#232222'}
                        />
                    </Pressable>

                    {/* Menu Button */}
                    <Pressable
                        onPress={handleMenuPress}
                        className="h-11 w-11 items-center justify-center rounded-full active:bg-mid-grey">
                        <View style={{ transform: [{ rotate: '90deg' }] }}>
                            <Monicon name="solar:menu-dots-bold" size={20} color="#232222" />
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
            />
        </SafeAreaView>
    );
}
