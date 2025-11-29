"use client"

import { createContext, useContext, useMemo, useState } from "react"
import { type Article } from "@readspace/shared"
import { useArticleAI } from "./hooks/use-article-ai"
import { useArticleInteractions } from "./hooks/use-article-interactions"
import { useIsMobile } from "@/hooks/use-mobile"

type UseArticleAIResult = ReturnType<typeof useArticleAI>
type UseArticleInteractionsResult = ReturnType<typeof useArticleInteractions>

interface ArticleContextValue extends UseArticleAIResult, UseArticleInteractionsResult {
    article: Article
    contentSource: "original" | "extracted" | "translated"
    setContentSource: (source: "original" | "extracted" | "translated") => void
    displayContent: string
    isTranslating: boolean
    onBack?: () => void
    isReadLaterMode: boolean
    isRecentlyReadMode: boolean
    shouldShowPreviewBanner: boolean
    // New state values
    currentContent: string
    currentReadTime: number | null
    isShowingSummary: boolean
    setCurrentReadTime: (time: number | null) => void
    shouldShowFeedBadge: boolean
}

const ArticleContext = createContext<ArticleContextValue | null>(null)

export function useArticleContext() {
    const context = useContext(ArticleContext)
    if (!context) throw new Error("useArticleContext must be used within ArticleProvider")
    return context
}

interface ArticleProviderProps {
    article: Article
    children: React.ReactNode
    isRecentlyReadMode?: boolean
    isReadLaterMode?: boolean
    shouldShowPreviewBanner?: boolean
    shouldShowFeedBadge?: boolean
    onMarkAsRead?: () => void
    onArticleRemoved?: () => void
    onBack?: () => void
}

export function ArticleContentProvider({
    article,
    children,
    isRecentlyReadMode = false,
    isReadLaterMode = false,
    shouldShowPreviewBanner = false,
    shouldShowFeedBadge = false,
    onMarkAsRead,
    onArticleRemoved,
    onBack,
}: ArticleProviderProps) {
    // Internal state moved from ArticleDetailContainer
    const [currentContent, setCurrentContent] = useState("")
    const [currentReadTime, setCurrentReadTime] = useState<number | null>(null)
    const [isShowingSummary, setIsShowingSummary] = useState(false)
    const [isTranslating, setIsTranslating] = useState(false)

    const [contentSource, setContentSource] = useState<"original" | "extracted" | "translated">(
        article.extracted_content ? "extracted" : "original"
    )

    const isMobile = useIsMobile()

    // Handlers that were previously passed as props
    const handleContentChange = (content: string, _key: string) => {
        setCurrentContent(content)
    }

    const handleSummaryChange = (summary: string | null, isShowing: boolean) => {
        setIsShowingSummary(isShowing)
    }

    const handleTranslationChange = (translating: boolean) => {
        setIsTranslating(translating)
    }

    const aiResult = useArticleAI({
        article,
        contentSource,
        onContentChange: handleContentChange,
        onSummaryChange: handleSummaryChange,
        onTranslationChange: handleTranslationChange,
        setContentSource,
    })

    const interactionsResult = useArticleInteractions({
        article,
        isRecentlyReadMode,
        isReadLaterMode,
        shouldShowPreviewBanner,
        isMobile: !!isMobile,
        onMarkAsRead,
        onArticleRemoved,
    })

    const displayContent = useMemo(() => {
        if (contentSource === "translated") return aiResult.translatedContent || ""
        if (contentSource === "extracted") return article.extracted_content || ""
        return article.content || article.description || ""
    }, [contentSource, aiResult.translatedContent, article])

    const value = useMemo(() => ({
        ...aiResult,
        ...interactionsResult,
        article,
        contentSource,
        setContentSource,
        displayContent,
        isTranslating,
        onBack,
        isReadLaterMode,
        isRecentlyReadMode,
        shouldShowPreviewBanner,
        currentContent,
        currentReadTime,
        isShowingSummary,
        setCurrentReadTime,
        shouldShowFeedBadge,
    }), [
        aiResult,
        interactionsResult,
        article,
        contentSource,
        displayContent,
        isTranslating,
        onBack,
        isReadLaterMode,
        isRecentlyReadMode,
        shouldShowPreviewBanner,
        currentContent,
        currentReadTime,
        isShowingSummary,
        shouldShowFeedBadge,
    ])

    return (
        <ArticleContext.Provider value={value}>
            {children}
        </ArticleContext.Provider>
    )
}
