import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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

    // Prefer extracted content as soon as the server has it. The article arrives in two
    // stages — a list summary (never carries `extracted_content`) then the detail fetch —
    // so the initial `useState` above usually resolves to Original and this effect is what
    // actually lands the reader on the full text. It must not be gated on a "previous
    // value" ref: the reader is remounted per article (`key={article.id}`), so such a ref
    // initialises to the *current* value and the switch never fires. Tracking whether the
    // user has chosen a view themselves is both correct and what mobile already does.
    const hasUserChosenView = useRef(false)
    useEffect(() => {
        if (article.extracted_content && !hasUserChosenView.current) {
            setContentView(ContentView.Extracted)
        }
    }, [article.extracted_content])

    const selectContentView = useCallback((view: ContentView) => {
        hasUserChosenView.current = true
        setContentView(view)
    }, [])

    const ai = useArticleAI({
        article,
        contentView,
        setContentView: selectContentView,
    })

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

    // The toolbar reflects the view actually being shown. It used to claim "Extracted"
    // whenever the article was loading, which made the Full Text tab flash selected during
    // the detail fetch and then snap back to Original the moment it resolved — a visible
    // revert that looked like a failed extraction.
    return {
        ...ai,
        ...interactions,
        contentView,
        setContentView: selectContentView,
        activeTab: contentView,
        contentKey,
        clientReadTime,
        isBusy: !!isLoading || ai.isExtracting || ai.isTranslating,
        aiSummary: isAiSummaryDismissed ? null : ai.aiSummary,
        resetAiSummaryDismissed: () => setIsAiSummaryDismissed(false),
        dismissAiSummary: () => setIsAiSummaryDismissed(true),
    }
}
