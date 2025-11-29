import { ArticleDetailContainer } from "./ArticleDetailContainer"
import { ArticleContentSkeleton } from "./ArticleContentSkeleton"
import type { Article } from "@readspace/shared"

interface ArticlesDetailProps {
    article?: Article | null
    isLoading?: boolean
    isRecentlyReadMode: boolean
    isReadLaterMode: boolean
    shouldShowPreviewBanner: boolean
    onMarkAsRead: () => void
    onArticleRemoved: () => void
    onBack: () => void
}

export function ArticlesDetail({
    article,
    isLoading,
    isRecentlyReadMode,
    isReadLaterMode,
    shouldShowPreviewBanner,
    onMarkAsRead,
    onArticleRemoved,
    onBack,
}: ArticlesDetailProps) {
    if (isLoading) {
        return <ArticleContentSkeleton />
    }

    if (!article) {
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
            key={article.id}
            article={article}
            isRecentlyReadMode={isRecentlyReadMode}
            isReadLaterMode={isReadLaterMode}
            shouldShowPreviewBanner={shouldShowPreviewBanner}
            onMarkAsRead={onMarkAsRead}
            onArticleRemoved={onArticleRemoved}
            onBack={onBack}
        />
    )
}
