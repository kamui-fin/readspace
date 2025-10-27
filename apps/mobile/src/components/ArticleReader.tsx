import type { MockArticleData } from '@/utils/mockArticle';
import { Galeria } from '@nandorojo/galeria';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import RenderHTML from 'react-native-render-html';
import { AISummaryCard } from './AISummaryCard';

export interface ArticleReaderProps {
    article: MockArticleData;
    aiSummary?: string;
    isLoadingSummary?: boolean;
    onCloseSummary?: () => void;
}

export function ArticleReader({ article, aiSummary, isLoadingSummary, onCloseSummary }: ArticleReaderProps) {
    const { width } = useWindowDimensions();

    // Configure HTML rendering with beautiful typography (EB Garamond for body text)
    const tagsStyles = useMemo(
        () => ({
            body: {
                fontFamily: 'EBGaramond_400Regular',
                fontSize: 18,
                lineHeight: 30,
                color: '#232222',
            },
            p: {
                marginBottom: 20,
                fontFamily: 'EBGaramond_400Regular',
                fontSize: 18,
                lineHeight: 30,
                color: '#232222',
            },
            h1: {
                fontFamily: 'EBGaramond_700Bold',
                fontSize: 32,
                lineHeight: 40,
                color: '#232222',
                marginTop: 32,
                marginBottom: 16,
            },
            h2: {
                fontFamily: 'EBGaramond_700Bold',
                fontSize: 24,
                lineHeight: 32,
                color: '#232222',
                marginTop: 28,
                marginBottom: 12,
            },
            h3: {
                fontFamily: 'EBGaramond_600SemiBold',
                fontSize: 20,
                lineHeight: 28,
                color: '#232222',
                marginTop: 24,
                marginBottom: 10,
            },
            strong: {
                fontFamily: 'EBGaramond_600SemiBold',
                color: '#232222',
            },
            em: {
                fontStyle: 'italic' as const,
            },
            a: {
                color: '#2563EB',
                textDecorationLine: 'underline' as const,
            },
        }),
        []
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
        ],
        []
    );

    return (
        <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingBottom: 80 }}>
            {/* Featured Image with Galeria */}
            <Galeria urls={[article.imageUrl]}>
                <Galeria.Image>
                    <View className="w-full bg-black" style={{ height: 240 }}>
                        <Image
                            source={{ uri: article.imageUrl }}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                            priority="high"
                        />
                    </View>
                </Galeria.Image>
            </Galeria>

            {/* Article Header */}
            <View className="mx-6 mb-6 mt-6 border-b border-light-grey pb-6">
                <View className="mb-2 flex-row items-center gap-2">
                    <Image
                        source={{ uri: article.sourceFavicon }}
                        style={{ width: 16, height: 16, borderRadius: 2 }}
                        contentFit="contain"
                    />
                    <Text className="font-geist text-sm uppercase tracking-wide text-grey">
                        {article.source}
                    </Text>
                </View>
                <Text
                    className="mb-3 font-geist-bold text-3xl leading-tight text-black"
                    style={{ letterSpacing: -0.72 }}>
                    {article.title}
                </Text>
                <View className="flex-row items-center gap-2">
                    <Text className="font-geist text-sm text-grey">By {article.author}</Text>
                    <Text className="font-geist text-sm text-grey">/</Text>
                    <Text className="font-geist text-sm text-grey">{article.date}</Text>
                    <Text className="font-geist text-sm text-grey">/</Text>
                    <Text className="font-geist text-sm text-grey">{article.readTime}</Text>
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
                    contentWidth={width - 48}
                    source={{ html: article.htmlContent }}
                    tagsStyles={tagsStyles}
                    systemFonts={systemFonts}
                    enableExperimentalMarginCollapsing
                />
            </View>
        </ScrollView>
    );
}
