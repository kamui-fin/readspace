import { ArticlesHeader } from "./ArticlesHeader"
import { ArticlesList } from "./ArticlesList"
import { FeedPreviewBanner } from "@/components/features/feeds/FeedPreviewBanner"
import type { FeedSummary, Article } from "@readspace/shared"

interface ArticlesSidebarProps {
    title: string
    unreadCount: number
    showUnreadOnly: boolean
    isReadLaterMode: boolean
    feedId?: string
    folderId?: string
    isDeepRefreshing: boolean
    isMarkingAllRead: boolean
    onToggleUnreadOnly: () => void
    onDeepRefresh: () => void
    onMarkAllRead: () => void
    shouldShowPreviewBanner: boolean
    feedData?: FeedSummary | null
    onFollow: () => void
    articles: Article[]
    selectedArticleId?: string | null
    onArticleSelect: (articleId: string) => void
    fetchNextPage: () => void
    hasNextPage: boolean
    isLoading: boolean
    isFetching: boolean
    isFetchingNextPage: boolean
    isRecentlyReadMode: boolean
    isTodayMode: boolean
}

export function ArticlesSidebar({
    title,
    unreadCount,
    showUnreadOnly,
    isReadLaterMode,
    feedId,
    folderId,
    isDeepRefreshing,
    isMarkingAllRead,
    onToggleUnreadOnly,
    onDeepRefresh,
    onMarkAllRead,
    shouldShowPreviewBanner,
    feedData,
    onFollow,
    articles,
    selectedArticleId,
    onArticleSelect,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetching,
    isFetchingNextPage,
    isRecentlyReadMode,
    isTodayMode,
}: ArticlesSidebarProps) {
    return (
        <div className="flex flex-col h-full">
            <ArticlesHeader
                title={title}
                unreadCount={unreadCount}
                showUnreadOnly={showUnreadOnly}
                isReadLaterMode={isReadLaterMode}
                feedId={feedId}
                folderId={folderId}
                isDeepRefreshing={isDeepRefreshing}
                isMarkingAllRead={isMarkingAllRead}
                onToggleUnreadOnly={onToggleUnreadOnly}
                onDeepRefresh={onDeepRefresh}
                onMarkAllRead={onMarkAllRead}
            />

            {shouldShowPreviewBanner && feedData && (
                <div className="flex-shrink-0">
                    <FeedPreviewBanner
                        feedTitle={feedData.title}
                        onFollow={onFollow}
                    />
                </div>
            )}

            <div className="flex-1 overflow-hidden">
                <ArticlesList
                    articles={articles}
                    selectedArticleId={selectedArticleId ?? null}
                    onArticleSelect={onArticleSelect}
                    fetchNextPage={fetchNextPage}
                    hasNextPage={hasNextPage}
                    isLoading={isLoading}
                    isFetching={isFetching}
                    isFetchingNextPage={isFetchingNextPage}
                    showUnreadOnly={showUnreadOnly}
                    isRecentlyReadMode={isRecentlyReadMode}
                    isReadLaterMode={isReadLaterMode}
                    isTodayMode={isTodayMode}
                    feedId={feedId}
                    folderId={folderId}
                />
            </div>
        </div>
    )
}
