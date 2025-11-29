import {
    createTranslationQueryKey,
    fetchTranslation,
    useExtractFullText,
    useSummarizeArticle,
    type Article,
    RSS_QUERY_KEYS,
} from "@readspace/shared"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"

interface UseArticleAIProps {
    article: Article
    contentSource: "original" | "extracted" | "translated"
    onContentChange: (content: string, key: string) => void
    onSummaryChange: (summary: string | null, isShowing: boolean) => void
    onTranslationChange: (isTranslating: boolean) => void
    setContentSource: (source: "original" | "extracted" | "translated") => void
}

export function useArticleAI({
    article,
    contentSource,
    onContentChange,
    onSummaryChange,
    onTranslationChange,
    setContentSource,
}: UseArticleAIProps) {
    const [aiSummary, setAiSummary] = useState<string | null>(null)
    const [contentKey, setContentKey] = useState(`original-${article.id}`)
    const [translatedContent, setTranslatedContent] = useState<string | null>(
        null
    )
    const [translatedLanguage, setTranslatedLanguage] = useState<string | null>(
        null
    )

    const queryClient = useQueryClient()

    // For AI operations (summary, translation), always use the base content (original or extracted)
    const baseContentForAI =
        contentSource === "extracted" && article.extracted_content
            ? article.extracted_content
            : article.content || article.description || ""

    const extractFullText = useExtractFullText(
        article?.id || "skip",
        article?.link || undefined
    )
    const summarizeArticle = useSummarizeArticle(
        article?.id || "skip",
        baseContentForAI
    )

    // Reset state when article changes
    useEffect(() => {
        setTranslatedContent(null)
        setTranslatedLanguage(null)
        setAiSummary(null)
        const originalKey = `original-${article.id}`
        setContentKey(originalKey)
        onContentChange(article.content || "", originalKey)
        onSummaryChange(null, false)
    }, [article.id, article.content, onContentChange, onSummaryChange])

    const handleExtractContent = async () => {
        try {
            const { data } = await extractFullText.refetch()

            if (data && data.content) {
                // Update the article cache with extracted content
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.ARTICLES, article.id],
                    (old: Article | undefined) => {
                        if (!old) return old
                        return {
                            ...old,
                            extracted_content: data.content,
                            estimated_read_time_minutes:
                                data.estimated_read_time_minutes ||
                                old.estimated_read_time_minutes,
                        }
                    }
                )

                // Automatically switch to extracted content after successful extraction
                setContentSource("extracted")
                toast.success("Content extracted successfully")
            }
        } catch (error) {
            console.error("Extract content error:", error)
            toast.error("Failed to extract content")
        }
    }

    const handleSummarize = async () => {
        try {
            const { data } = await summarizeArticle.refetch()

            if (data && data.summary) {
                setAiSummary(data.summary)
                onSummaryChange(data.summary, true)
                toast.success("Summary generated")
            }
        } catch (error) {
            console.error("Summarize article error:", error)
            toast.error("Failed to generate summary")
        }
    }

    const handleTranslate = async (targetLanguage: string) => {
        try {
            onTranslationChange(true)
            // Use the active content based on content source (but not translated content)
            const contentToUse =
                contentSource === "extracted" && article.extracted_content
                    ? article.extracted_content
                    : article.content || article.description || ""

            // Check cache first
            const queryKey = createTranslationQueryKey(
                article.id,
                targetLanguage,
                contentToUse
            )

            type TranslationCache = {
                translated_content: string
            }
            const cachedData =
                queryClient.getQueryData<TranslationCache>(queryKey)

            if (cachedData && cachedData.translated_content) {
                const newKey = `translated-${targetLanguage}-${article.id}`
                setContentKey(newKey)
                setTranslatedContent(cachedData.translated_content)
                setTranslatedLanguage(targetLanguage)
                onContentChange(cachedData.translated_content, newKey)
                // Switch to translated tab
                setContentSource("translated")
                toast.success(`Article translated successfully`)
                return
            }

            // Fetch new translation with caching
            const data = await fetchTranslation(
                queryClient,
                article.id,
                targetLanguage,
                contentToUse
            )

            if (data && data.translated_content) {
                const newKey = `translated-${targetLanguage}-${article.id}`
                setContentKey(newKey)
                setTranslatedContent(data.translated_content)
                setTranslatedLanguage(targetLanguage)
                onContentChange(data.translated_content, newKey)
                // Switch to translated tab
                setContentSource("translated")
                toast.success(`Article translated successfully`)
            }
        } catch (error) {
            console.error("Translation error:", error)
            toast.error("Failed to translate article")
        } finally {
            onTranslationChange(false)
        }
    }

    return {
        aiSummary,
        contentKey,
        translatedContent,
        translatedLanguage,
        extractFullText,
        summarizeArticle,
        handleExtractContent,
        handleSummarize,
        handleTranslate,
    }
}
