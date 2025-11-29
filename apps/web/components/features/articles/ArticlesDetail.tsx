import { ArticleDetailContainer } from "./ArticleDetailContainer"
import { ArticleContentSkeleton } from "./ArticleContentSkeleton"
import { useArticlesContext } from "./ArticlesContext"

export function ArticlesDetail() {
    const {
        selectedArticle,
        isRecentlyReadMode,
        isReadLaterMode,
        shouldShowPreviewBanner,
        handleMarkAsRead,
        handleBackToList,
        feedId,
    } = useArticlesContext()

    if (!selectedArticle) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground bg-muted/5">
                <div className="text-center">
                    <h3 className="text-lg font-medium mb-2">
                        Select an article
                    </h3>
                    <p className="text-sm">
                        Choose an article from the list to read
                    </p>
                </div>
            </div>
        )
    }

    return (
        <ArticleDetailContainer
            key={selectedArticle.id}
            article={selectedArticle}
            isRecentlyReadMode={isRecentlyReadMode}
            isReadLaterMode={isReadLaterMode}
            shouldShowPreviewBanner={shouldShowPreviewBanner}
            shouldShowFeedBadge={!feedId}
            onMarkAsRead={handleMarkAsRead}
            onArticleRemoved={() => { }}
            onBack={handleBackToList}
        />
    )
}
