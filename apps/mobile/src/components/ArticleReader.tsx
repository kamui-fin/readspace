import { stripHtml } from '@/utils/html';
import { Monicon } from '@monicon/native';
import { Galeria } from '@nandorojo/galeria';
import type { Article } from '@readspace/shared';
import { calculateReadingTime } from '@readspace/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import RenderHTML from 'react-native-render-html';
import Constants from 'expo-constants';
import { AISummaryCard } from './AISummaryCard';

export interface ArticleReaderProps {
    article: Article;
    aiSummary?: string;
    isLoadingSummary?: boolean;
    onCloseSummary?: () => void;
}

export function ArticleReader({
    article,
    aiSummary,
    isLoadingSummary,
    onCloseSummary,
}: ArticleReaderProps) {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    // Dynamic colors for dark mode
    const textColor = isDark ? '#ffffff' : '#232222';
    const greyColor = isDark ? '#b0b0b0' : '#90988B';
    const bgColor = isDark ? '#0a0a0a' : '#FFFFFF';
    const lightGreyColor = isDark ? '#1a1a1a' : '#F9F9F9';
    const midGreyColor = isDark ? '#2a2a2a' : '#F3F3F3';

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

    /**
     * Get priority color based on priority level and color scheme
     */
    const getPriorityColor = (priorityLevel: string): string => {
        switch (priorityLevel) {
            case 'high':
                return isDark ? '#FCA5A5' : '#EF4444'; // red-300 : red-500
            case 'medium':
                return isDark ? '#FDBA74' : '#F97316'; // orange-300 : orange-500
            case 'low':
                return isDark ? '#6EE7B7' : '#10B981'; // green-300 : green-500
            default:
                return isDark ? '#93C5FD' : '#3B82F6'; // blue-300 : blue-500
        }
    };

    /**
     * Get priority background color based on priority level and color scheme
     */
    const getPriorityBgColor = (priorityLevel: string): string => {
        switch (priorityLevel) {
            case 'high':
                return isDark ? '#7F1D1D' : '#FEE2E2'; // red-900 : red-100
            case 'medium':
                return isDark ? '#7C2D12' : '#FFEDD5'; // orange-900 : orange-100
            case 'low':
                return isDark ? '#064E3B' : '#D1FAE5'; // green-900 : green-100
            default:
                return isDark ? '#1E3A8A' : '#DBEAFE'; // blue-900 : blue-100
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
                fontFamily: 'EBGaramond_400Regular_Italic',
            },
            i: {
                fontFamily: 'EBGaramond_400Regular_Italic',
            },
            u: {
                textDecorationLine: 'underline' as const,
            },
            s: {
                textDecorationLine: 'line-through' as const,
                color: greyColor,
            },
            mark: {
                backgroundColor: '#FEF3C7',
                color: textColor,
            },
            // Links with brand secondary color
            a: {
                color: '#6A994E',
                textDecorationLine: 'underline' as const,
                fontFamily: 'EBGaramond_500Medium',
            },
            // Code elements with monospace font
            code: {
                fontFamily: 'GeistMono_400Regular',
                fontSize: 16,
                lineHeight: 24,
                backgroundColor: midGreyColor,
                color: '#386641',
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
                fontFamily: 'EBGaramond_400Regular_Italic',
                fontSize: 18,
                lineHeight: 30,
                color: textColor,
                borderLeftWidth: 4,
                borderLeftColor: '#6A994E',
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
                borderColor: '#D1DBCD',
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
                color: '#386641',
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
        [textColor, greyColor, bgColor, lightGreyColor, midGreyColor]
    );

    const systemFonts = useMemo(
        () => [
            'EBGaramond_400Regular',
            'EBGaramond_400Regular_Italic',
            'EBGaramond_500Medium',
            'EBGaramond_500Medium_Italic',
            'EBGaramond_600SemiBold',
            'EBGaramond_600SemiBold_Italic',
            'EBGaramond_700Bold',
            'EBGaramond_700Bold_Italic',
            'Geist_400Regular',
            'Geist_500Medium',
            'Geist_600SemiBold',
            'Geist_700Bold',
            'GeistMono_400Regular',
            'GeistMono_500Medium',
            'GeistMono_600SemiBold',
            'GeistMono_700Bold',
            'serif',
            ...Constants.systemFonts
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

    const feedTitle = article.feed_title || undefined;
    const feedImageUrl = article.feed_icon || undefined;
    const feedId = article.feed_id || undefined;

    // Check if there's a feed_id field directly on the article
    if (!feedId && (article as any).feed_id) {
        feedId = (article as any).feed_id;
    }

    console.log('ArticleReader - Full article keys:', Object.keys(article));
    console.log('ArticleReader - isClipped:', isClipped, 'feedId:', feedId, 'feedTitle:', feedTitle, 'feed_id:', article.feed_id);

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

    const displayFaviconUrl = isClipped && article.link
        ? getFaviconUrl(article.link)
        : feedImageUrl;

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

        // Remove figure tags containing the featured image (do this first)
        const figurePattern = /<figure[^>]*>[\s\S]*?<img[^>]*src=["'][^"']*["'][^>]*>[\s\S]*?<\/figure>/gi;
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
        <ScrollView className="flex-1 bg-white dark:bg-white-dark" contentContainerStyle={{ paddingBottom: 80 }}>
            {/* Featured Image with Galeria */}
            {article.image_url && (
                <Galeria urls={[article.image_url]}>
                    <Galeria.Image>
                        <View className="w-full bg-black" style={{ height: 240 }}>
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
            <View className="mx-6 mb-6 mt-6 border-b border-light-grey dark:border-light-grey-dark pb-6">
                {/* Source and Priority */}
                {!isClipped && feedId ? (
                    <Pressable
                        onPress={() => {
                            console.log('PRESSED! Navigating to feed:', feedId);
                            router.push(`/discover/feed/${feedId}`);
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
                        {/* Priority badge for clipped articles */}
                        {isClipped && article.priority && (
                            <View
                                style={{
                                    backgroundColor: getPriorityBgColor(article.priority),
                                    borderRadius: 12,
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                }}>
                                <Monicon
                                    name="solar:paperclip-bold"
                                    size={12}
                                    color={getPriorityColor(article.priority)}
                                />
                                <Text
                                    style={{
                                        fontSize: 11,
                                        fontWeight: '600',
                                        color: getPriorityColor(article.priority),
                                        textTransform: 'capitalize',
                                    }}>
                                    {article.priority}
                                </Text>
                            </View>
                        )}

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
                    className="mb-3 font-geist-bold text-3xl leading-tight text-black dark:text-black-dark"
                    style={{ letterSpacing: -0.72 }}>
                    {stripHtml(article.title)}
                </Text>

                {/* Note for clipped articles */}
                {isClipped && article.user_note && (
                    <View className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 border border-amber-200 dark:border-amber-800">
                        <Text className="font-geist text-sm leading-relaxed text-grey dark:text-grey-dark">
                            {article.user_note}
                        </Text>
                    </View>
                )}

                {/* Metadata */}
                <View className="flex-row flex-wrap items-center gap-2">
                    {article.author && !isClipped && (
                        <>
                            <Text className="font-geist text-sm text-grey dark:text-grey-dark flex-shrink" numberOfLines={1}>
                                By {article.author}
                            </Text>
                            <Text className="font-geist text-sm text-grey dark:text-grey-dark">/</Text>
                        </>
                    )}
                    <Text className="font-geist text-sm text-grey dark:text-grey-dark flex-shrink" numberOfLines={1}>
                        {displayDate}
                    </Text>
                    {readTime && <Text className="font-geist text-sm text-grey dark:text-grey-dark">/</Text>}
                    {readTime && (
                        <Text className="font-geist text-sm text-grey dark:text-grey-dark flex-shrink" numberOfLines={1}>
                            {readTime}
                        </Text>
                    )}
                </View>
            </View>

            {/* AI Summary Card */}
            <AISummaryCard
                summary={aiSummary}
                isLoading={isLoadingSummary}
                onClose={onCloseSummary}
            />

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
