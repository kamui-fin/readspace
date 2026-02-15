import { ArticleContent } from "./ArticleContent"
import { useArticle, type Article } from "@readspace/shared"

interface ArticlesDetailProps {
    article: Article | undefined
    isRecentlyReadMode: boolean
    isReadLaterMode: boolean
    shouldShowPreviewBanner: boolean
    onMarkAsRead: () => void
    onBack: () => void
    feedId?: string
}

export function ArticlesDetail({
    article: initialArticle,
    isRecentlyReadMode,
    isReadLaterMode,
    shouldShowPreviewBanner,
    onMarkAsRead,
    onBack,
}: ArticlesDetailProps) {
    const { data: fullArticle, isFetching } = useArticle(
        initialArticle?.id || "",
        {
            enabled: !!initialArticle?.id,
            initialData: initialArticle,
            // Treat initial data (summary) as stale immediately to ensure we fetch the full content
            initialDataUpdatedAt: 0,
            // Cache the full article for 5 minutes once fetched
            staleTime: 5 * 60 * 1000,
            articleType: initialArticle?.article_type,
        }
    )

    const article = fullArticle || initialArticle
    const isContentLoading =
        isFetching && !article?.content && !article?.extracted_content

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
        <ArticleContent
            key={article.id}
            article={article}
            isRecentlyReadMode={isRecentlyReadMode}
            isReadLaterMode={isReadLaterMode}
            shouldShowPreviewBanner={shouldShowPreviewBanner}
            shouldShowFeedBadge={true}
            onMarkAsRead={onMarkAsRead}
            onArticleRemoved={() => {}}
            onBack={onBack}
            isLoading={isContentLoading}
        />
    )
}
