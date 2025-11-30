import {
    ContentView,
    useExtractFullTextMutation,
    useSummarizeArticleMutation,
    useTranslateArticleMutation,
    type Article,
} from "@readspace/shared"
import { useMemo, useState } from "react"

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

    // Use mutation hooks from shared package
    const extractMutation = useExtractFullTextMutation()
    const summarizeMutation = useSummarizeArticleMutation()
    const translateMutation = useTranslateArticleMutation()

    // Determine active content based on current view
    const activeContent = useMemo(() => {
        if (contentView === ContentView.Translated && currentTranslation) {
            return currentTranslation.content
        }
        if (contentView === ContentView.Extracted) {
            return article.extracted_content || extractMutation.data?.content || null
        }
        return article.content || article.description || ""
    }, [contentView, article, currentTranslation, extractMutation.data])

    // Content to pass to AI operations
    const contentForAI = article.extracted_content || extractMutation.data?.content || article.content || ""

    return {
        // Data
        aiSummary: summarizeMutation.data?.summary || null,
        displayContent: activeContent,
        translatedContent: currentTranslation?.content || null,
        translatedLanguage: currentTranslation?.language || null,

        // Loading states
        isExtracting: extractMutation.isPending,
        isSummarizing: summarizeMutation.isPending,
        isTranslating: translateMutation.isPending,

        // Actions
        handleExtractContent: async () => {
            await extractMutation.mutateAsync({
                articleId: article.id,
                articleUrl: article.link,
            })
            setContentView(ContentView.Extracted)
        },
        handleSummarize: async () => {
            await summarizeMutation.mutateAsync({
                articleId: article.id,
                content: activeContent || contentForAI,
            })
        },
        handleTranslate: async (language: string) => {
            const result = await translateMutation.mutateAsync({
                articleId: article.id,
                targetLanguage: language,
                content: contentForAI,
            })
            setCurrentTranslation({
                content: result.translated_content,
                language: result.target_language,
            })
            setContentView(ContentView.Translated)
        },
    }
}
