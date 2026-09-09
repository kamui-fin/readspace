import {
    ContentView,
    useExtractFullTextMutation,
    useGenerateHighlightsMutation,
    useSummarizeArticleMutation,
    useTranslateArticleMutation,
    type Article,
} from "@readspace/shared"
import { useEffect, useMemo, useState } from "react"
import { toast } from "react-hot-toast"

interface UseArticleAIProps {
    article: Article
    contentView: ContentView
    setContentView: (view: ContentView) => void
}

export function useArticleAI({
    article,
    contentView,
    setContentView,
}: UseArticleAIProps) {
    const [currentTranslation, setCurrentTranslation] = useState<{
        content: string
        language: string
    } | null>(null)
    const [currentSummaryLanguage, setCurrentSummaryLanguage] =
        useState("original")
    const [highlightedData, setHighlightedData] = useState<{
        content: string
        forView: ContentView
    } | null>(null)
    const [highlightsEnabled, setHighlightsEnabled] = useState(false)

    // Use mutation hooks from shared package
    const extractMutation = useExtractFullTextMutation()
    const summarizeMutation = useSummarizeArticleMutation()
    const translateMutation = useTranslateArticleMutation()
    const highlightMutation = useGenerateHighlightsMutation()

    // Determine active content based on current view
    const activeContent = useMemo(() => {
        if (contentView === ContentView.Translated && currentTranslation) {
            return currentTranslation.content
        }
        if (contentView === ContentView.Extracted) {
            return (
                article.extracted_content ||
                extractMutation.data?.content ||
                null
            )
        }
        return article.content || article.description || ""
    }, [contentView, article, currentTranslation, extractMutation.data])

    // Once generated, the highlighted HTML (with <mark> tags baked in) replaces the plain
    // content for its view permanently — toggling visibility afterward is CSS-only (no
    // re-render). Only valid for the view it was generated against; switching views falls
    // back to plain content until regenerated (cheap: the backend caches per article+view).
    const hasHighlightsForView = highlightedData?.forView === contentView
    const displayContent = hasHighlightsForView
        ? highlightedData.content
        : activeContent

    // Sync summary language with content view
    useEffect(() => {
        if (!summarizeMutation.data) return

        const targetLanguage =
            contentView === ContentView.Translated && currentTranslation
                ? currentTranslation.language
                : "original"

        if (targetLanguage !== currentSummaryLanguage) {
            setCurrentSummaryLanguage(targetLanguage)
            summarizeMutation.mutate({
                articleId: article.id,
                languageKey: targetLanguage,
                articleType: article.article_type,
            })
        }
    }, [
        contentView,
        currentTranslation,
        summarizeMutation.data,
        currentSummaryLanguage,
        article.id,
        article.article_type,
        summarizeMutation,
    ])

    return {
        // Data
        aiSummary: summarizeMutation.data?.summary || null,
        displayContent,
        translatedContent: currentTranslation?.content || null,
        translatedLanguage: currentTranslation?.language || null,
        highlightsEnabled: highlightsEnabled && hasHighlightsForView,
        hasHighlightsForView,

        // Loading states
        isExtracting: extractMutation.isPending,
        isSummarizing: summarizeMutation.isPending,
        isTranslating: translateMutation.isPending,
        isHighlighting: highlightMutation.isPending,

        // Actions
        handleExtractContent: async () => {
            if (extractMutation.isPending) return
            try {
                setContentView(ContentView.Extracted)
                await extractMutation.mutateAsync({
                    articleId: article.id,
                    articleUrl: article.link,
                    articleType: article.article_type,
                })
            } catch {
                setContentView(ContentView.Original)
                toast.error("Failed to extract article content", {
                    id: "extract-error",
                })
            }
        },
        handleSummarize: async () => {
            const languageKey =
                contentView === ContentView.Translated && currentTranslation
                    ? currentTranslation.language
                    : "original"

            setCurrentSummaryLanguage(languageKey)
            await summarizeMutation.mutateAsync({
                articleId: article.id,
                // Content is fetched by backend to save bandwidth
                languageKey,
                articleType: article.article_type,
            })
        },
        handleTranslate: async (language: string) => {
            const result = await translateMutation.mutateAsync({
                articleId: article.id,
                targetLanguage: language,
                // Content is fetched by backend to save bandwidth
                articleType: article.article_type,
            })
            setCurrentTranslation({
                content: result.translated_content,
                language: result.target_language,
            })
            setContentView(ContentView.Translated)
        },
        handleToggleHighlights: async () => {
            if (hasHighlightsForView) {
                // Already generated for this view — just flip visibility, no re-fetch
                setHighlightsEnabled((prev) => !prev)
                return
            }

            const languageKey =
                contentView === ContentView.Translated && currentTranslation
                    ? currentTranslation.language
                    : "original"

            const result = await highlightMutation.mutateAsync({
                articleId: article.id,
                content: activeContent || undefined,
                languageKey,
                articleType: article.article_type,
            })
            setHighlightedData({
                content: result.highlighted_content,
                forView: contentView,
            })
            setHighlightsEnabled(true)
        },
    }
}
