"use client"

import { createContext, useContext, useState } from "react"
import { type Article } from "@readspace/shared"
import { useArticleAI } from "../hooks/useArticleAI"
import { useArticleInteractions } from "../hooks/useArticleInteractions"
import { useIsMobile } from "../../../../hooks/use-mobile"

type UseArticleAIResult = ReturnType<typeof useArticleAI>
type UseArticleInteractionsResult = ReturnType<typeof useArticleInteractions>

interface ArticleContextValue
    extends UseArticleAIResult,
        UseArticleInteractionsResult {
    article: Article
    contentSource: "original" | "extracted" | "translated"
    setContentSource: (source: "original" | "extracted" | "translated") => void
    displayContent: string
    isTranslating: boolean
    onBack?: () => void
    isReadLaterMode: boolean
}

const ArticleContext = createContext<ArticleContextValue | null>(null)

export function useArticleContext() {
    const context = useContext(ArticleContext)
    if (!context)
        throw new Error("useArticleContext must be used within ArticleProvider")
    return context
}

interface ArticleProviderProps {
    article: Article
    children: React.ReactNode
    isTranslating: boolean
    onContentChange: (content: string, key: string) => void
    onSummaryChange: (summary: string | null, isShowing: boolean) => void
    onTranslationChange: (isTranslating: boolean) => void
    isRecentlyReadMode?: boolean
    isReadLaterMode?: boolean
    shouldShowPreviewBanner?: boolean
    onMarkAsRead?: () => void
    onArticleRemoved?: () => void
    onBack?: () => void
}

export function ArticleContentProvider({
    article,
    children,
    isTranslating,
    onContentChange,
    onSummaryChange,
    onTranslationChange,
    isRecentlyReadMode = false,
    isReadLaterMode = false,
    shouldShowPreviewBanner = false,
    onMarkAsRead,
    onArticleRemoved,
    onBack,
}: ArticleProviderProps) {
    const [contentSource, setContentSource] = useState<
        "original" | "extracted" | "translated"
    >(article.extracted_content ? "extracted" : "original")

    const isMobile = useIsMobile()

    const aiResult = useArticleAI({
        article,
        contentSource,
        onContentChange,
        onSummaryChange,
        onTranslationChange,
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

    let displayContent = ""
    if (contentSource === "translated")
        displayContent = aiResult.translatedContent || ""
    else if (contentSource === "extracted")
        displayContent = article.extracted_content || ""
    else displayContent = article.content || article.description || ""

    const value = {
        ...aiResult,
        ...interactionsResult,
        article,
        contentSource,
        setContentSource,
        displayContent,
        isTranslating,
        onBack,
        isReadLaterMode,
    }

    return (
        <ArticleContext.Provider value={value}>
            {children}
        </ArticleContext.Provider>
    )
}
