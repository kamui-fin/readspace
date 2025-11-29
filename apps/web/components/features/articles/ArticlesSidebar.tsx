import { ArticlesHeader } from "./ArticlesHeader"
import { ArticlesList } from "./ArticlesList"
import { FeedPreviewBanner } from "@/components/features/feeds/FeedPreviewBanner"
import { useArticlesContext } from "./ArticlesContext"

export function ArticlesSidebar() {
    const {
        feedData,
        shouldShowPreviewBanner,
        setIsSubscriptionModalOpen,
    } = useArticlesContext()

    return (
        <div className="flex flex-col h-full">
            <ArticlesHeader />

            {shouldShowPreviewBanner && feedData && (
                <div className="flex-shrink-0">
                    <FeedPreviewBanner
                        feedTitle={feedData.title}
                        onFollow={() => setIsSubscriptionModalOpen(true)}
                    />
                </div>
            )}

            <div className="flex-1 overflow-hidden">
                <ArticlesList />
            </div>
        </div>
    )
}
