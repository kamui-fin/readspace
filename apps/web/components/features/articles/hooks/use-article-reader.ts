import { useEffect, useMemo, useRef, useState } from "react"
import {
    type Article,
    ContentView,
    estimateReadingTime,
} from "@readspace/shared"

import { useArticleAI } from "./use-article-ai"
import { useArticleInteractions } from "./use-article-interactions"

interface UseArticleReaderProps {
    article: Article
    isRecentlyReadMode: boolean
    isReadLaterMode: boolean
    shouldShowPreviewBanner: boolean
    isMobile: boolean
    onMarkAsRead?: () => void
    onArticleRemoved?: () => void
    /** The split-view reader marks-as-read on load; the standalone route does not. */
    isLoading?: boolean
}

/**
 * The shared reader brain: content-view state (original / extracted / translated), the AI
 * actions, read-later + mark-as-read interactions, the client-side read-time estimate, and
 * the animation key. Consumed by both the split-view `ArticleContent` and the standalone
 * `/articles/[id]` route so the two stay in lockstep. Scroll handling and Zen Mode stay
 * with the caller — they own their own scroll container.
 */
export function useArticleReader({
    article,
    isRecentlyReadMode,
    isReadLaterMode,
    shouldShowPreviewBanner,
    isMobile,
    onMarkAsRead,
    onArticleRemoved,
    isLoading,
}: UseArticleReaderProps) {
    const [contentView, setContentView] = useState<ContentView>(
        article.extracted_content ? ContentView.Extracted : ContentView.Original
    )

    // Auto-switch to extracted view when content becomes available
    const prevExtractedContentRef = useRef(article.extracted_content)
    useEffect(() => {
        if (article.extracted_content && !prevExtractedContentRef.current) {
            setContentView(ContentView.Extracted)
        }
        prevExtractedContentRef.current = article.extracted_content
    }, [article.extracted_content])

    const ai = useArticleAI({ article, contentView, setContentView })

    const interactions = useArticleInteractions({
        article,
        isRecentlyReadMode,
        isReadLaterMode,
        shouldShowPreviewBanner,
        isMobile,
        onMarkAsRead,
        onArticleRemoved,
    })

    // Client-side read-time estimate
    const [clientReadTime, setClientReadTime] = useState(0)
    useEffect(() => {
        if (ai.displayContent) {
            setClientReadTime(
                estimateReadingTime(ai.displayContent.replace(/<[^>]*>/g, ""))
            )
        } else if (article.description) {
            setClientReadTime(
                estimateReadingTime(article.description.replace(/<[^>]*>/g, ""))
            )
        }
    }, [ai.displayContent, article.description])

    const [isAiSummaryDismissed, setIsAiSummaryDismissed] = useState(false)

    const contentKey = useMemo(() => {
        if (contentView === ContentView.Translated && ai.translatedLanguage) {
            return `translated-${ai.translatedLanguage}-${article.id}`
        }
        return `${contentView}-${article.id}`
    }, [contentView, article.id, ai.translatedLanguage])

    const activeTab =
        isLoading || ai.isExtracting ? ContentView.Extracted : contentView

    return {
        ...ai,
        ...interactions,
        contentView,
        setContentView,
        activeTab,
        contentKey,
        clientReadTime,
        isBusy: !!isLoading || ai.isExtracting || ai.isTranslating,
        aiSummary: isAiSummaryDismissed ? null : ai.aiSummary,
        resetAiSummaryDismissed: () => setIsAiSummaryDismissed(false),
        dismissAiSummary: () => setIsAiSummaryDismissed(true),
    }
}
