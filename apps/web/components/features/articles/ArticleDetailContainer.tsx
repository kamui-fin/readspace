import { ArticleContent } from "./ArticleContent"
import { ArticleContentProvider } from "./ArticleContext"
import type { Article } from "@readspace/shared"

interface ArticleDetailContainerProps {
    article: Article
    isRecentlyReadMode: boolean
    isReadLaterMode: boolean
    shouldShowPreviewBanner: boolean
    shouldShowFeedBadge: boolean
    onMarkAsRead: () => void
    onArticleRemoved: () => void
    onBack: () => void
}

export function ArticleDetailContainer({
    article,
    isRecentlyReadMode,
    isReadLaterMode,
    shouldShowPreviewBanner,
    shouldShowFeedBadge,
    onMarkAsRead,
    onArticleRemoved,
    onBack,
}: ArticleDetailContainerProps) {
    return (
        <ArticleContentProvider
            article={article}
            isRecentlyReadMode={isRecentlyReadMode}
            isReadLaterMode={isReadLaterMode}
            shouldShowPreviewBanner={shouldShowPreviewBanner}
            shouldShowFeedBadge={shouldShowFeedBadge}
            onMarkAsRead={onMarkAsRead}
            onArticleRemoved={onArticleRemoved}
            onBack={onBack}
        >
            <ArticleContent />
        </ArticleContentProvider>
    )
}
