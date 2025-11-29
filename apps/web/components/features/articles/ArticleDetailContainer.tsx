import { useState, useCallback } from "react"
import { ArticleContent } from "./ArticleContent"
import type { Article } from "@readspace/shared"

interface ArticleDetailContainerProps {
    article: Article
    isRecentlyReadMode: boolean
    isReadLaterMode: boolean
    shouldShowPreviewBanner: boolean
    onMarkAsRead: () => void
    onArticleRemoved: () => void
    onBack: () => void
}

export function ArticleDetailContainer({
    article,
    isRecentlyReadMode,
    isReadLaterMode,
    shouldShowPreviewBanner,
    onMarkAsRead,
    onArticleRemoved,
    onBack,
}: ArticleDetailContainerProps) {
    // Internal state for the article view
    // This state is reset when the key (article.id) changes in the parent
    const [currentContent, setCurrentContent] = useState("")
    const [currentReadTime, setCurrentReadTime] = useState<number | null>(null)
    const [isShowingSummary, setIsShowingSummary] = useState(false)
    const [isTranslating, setIsTranslating] = useState(false)

    const handleContentChange = useCallback((content: string) => {
        setCurrentContent(content)
    }, [])

    const handleReadTimeChange = useCallback((readTime: number | null) => {
        setCurrentReadTime(readTime)
    }, [])

    const handleSummaryChange = useCallback(
        (summary: string | null, isShowing: boolean) => {
            setIsShowingSummary(isShowing)
        },
        []
    )

    const handleTranslationChange = useCallback((translating: boolean) => {
        setIsTranslating(translating)
    }, [])

    return (
        <ArticleContent
            article={article}
            currentContent={currentContent}
            currentReadTime={currentReadTime}
            isShowingSummary={isShowingSummary}
            isTranslating={isTranslating}
            isRecentlyReadMode={isRecentlyReadMode}
            isReadLaterMode={isReadLaterMode}
            shouldShowPreviewBanner={shouldShowPreviewBanner}
            onContentChange={handleContentChange}
            onReadTimeChange={handleReadTimeChange}
            onSummaryChange={handleSummaryChange}
            onTranslationChange={handleTranslationChange}
            onMarkAsRead={onMarkAsRead}
            onArticleRemoved={onArticleRemoved}
            onBack={onBack}
        />
    )
}
