"use client"

import { ArticlesEmptyState } from "./ArticlesEmptyState"
import { ArticlesErrorState } from "./ArticlesErrorState"
import { ArticlesViewSkeleton } from "./ArticlesViewSkeleton"
import { FeedSubscriptionModal } from "@/components/features/feeds/FeedSubscriptionModal"
import { Button } from "@/components/ui/button"
import { useArticlesController } from "./hooks/useArticlesController"
import { ArticlesLayout } from "./ArticlesLayout"
import { ArticlesSidebar } from "./ArticlesSidebar"
import { ArticlesDetail } from "./ArticlesDetail"

interface ArticlesViewProps {
    /** Initial title for the sidebar */
    initialSidebarTitle?: string
    /** Feed ID for filtering articles */
    feedId?: string
    /** Folder ID for filtering articles */
    folderId?: string
    /** Published since date filter */
    publishedSince?: string
    /** Published until date filter */
    publishedUntil?: string
    /** View mode for articles */
    mode?: "allArticles" | "recentlyRead" | "readLater" | "today"
    /** Callback for creating new folder */
    onCreateFolder?: () => void
    /** Callback for adding new feed */
    onAddFeed?: (folderId?: string) => void
}

/**
 * Main ArticlesView component that displays articles in a resizable layout
 * with list and content views.
 */
export function ArticlesView(props: ArticlesViewProps) {
    const {
        // State & Data
        isMobile,
        feedData,
        feedError,
        isFeedLoading,
        allArticles,
        filteredArticles,
        isArticlesLoading,
        isFetching,
        isFetchingNextPage,
        hasNextPage,
        selectedArticleId,
        selectedArticle,
        showContent,
        showUnreadOnly,
        sidebarTitle,
        unreadCount,
        shouldShowPreviewBanner,
        isSubscriptionModalOpen,
        isRecentlyReadMode,
        isReadLaterMode,
        isTodayMode,

        // Loading States
        isDeepRefreshing,
        isMarkingAllRead,

        // Actions
        fetchNextPage,
        handleArticleSelect,
        handleBackToList,
        toggleShowUnreadOnly,
        handleRefreshWithMessage,
        handleDeepRefresh,
        handleMarkAllAsRead,
        handleMarkAsRead,
        setIsSubscriptionModalOpen,
    } = useArticlesController(props)

    const isInitialLoading = isArticlesLoading && allArticles.length === 0

    if (isInitialLoading) {
        return <ArticlesViewSkeleton showUnreadBadge={false} />
    }

    if (props.feedId && feedError && !isFeedLoading) {
        return (
            <div className="flex h-[calc(100vh-1rem)] w-full bg-background rounded-xl shadow-sm">
                <ArticlesErrorState
                    error={feedError}
                    onRetry={() => handleRefreshWithMessage("Retrying...")}
                />
            </div>
        )
    }

    if (
        !isArticlesLoading &&
        !isFetching &&
        filteredArticles.length === 0 &&
        allArticles.length === 0
    ) {
        return (
            <div className="flex h-[calc(100vh-1rem)] w-full bg-background rounded-xl shadow-sm">
                <ArticlesEmptyState
                    mode={props.mode}
                    feedId={props.feedId}
                    folderId={props.folderId}
                    isPreviewMode={shouldShowPreviewBanner}
                    previewRefreshFailed={false}
                    onRefresh={() =>
                        handleRefreshWithMessage("Refreshing articles...")
                    }
                />
            </div>
        )
    }

    if (filteredArticles.length === 0 && allArticles.length > 0) {
        return (
            <div className="flex h-full md:h-[calc(100vh-1rem)] w-full bg-background md:rounded-xl md:shadow-sm">
                <div className="w-full flex flex-col items-center justify-center gap-4">
                    <p className="text-muted-foreground">
                        No unread articles found matching your filters.
                    </p>
                    <Button variant="outline" onClick={toggleShowUnreadOnly}>
                        Show All Articles
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-[100dvh] md:h-[calc(100vh-1rem)] w-full bg-background md:rounded-xl md:shadow-sm">
            <ArticlesLayout
                isMobile={isMobile}
                showContent={showContent}
                sidebar={
                    <ArticlesSidebar
                        title={sidebarTitle}
                        unreadCount={unreadCount}
                        showUnreadOnly={showUnreadOnly}
                        isReadLaterMode={isReadLaterMode}
                        feedId={props.feedId}
                        folderId={props.folderId}
                        isDeepRefreshing={isDeepRefreshing}
                        isMarkingAllRead={isMarkingAllRead}
                        onToggleUnreadOnly={toggleShowUnreadOnly}
                        onDeepRefresh={handleDeepRefresh}
                        onMarkAllRead={handleMarkAllAsRead}
                        shouldShowPreviewBanner={shouldShowPreviewBanner}
                        feedData={feedData}
                        onFollow={() => setIsSubscriptionModalOpen(true)}
                        articles={filteredArticles}
                        selectedArticleId={selectedArticleId}
                        onArticleSelect={handleArticleSelect}
                        fetchNextPage={fetchNextPage}
                        hasNextPage={hasNextPage}
                        isLoading={isArticlesLoading}
                        isFetching={isFetching}
                        isFetchingNextPage={isFetchingNextPage}
                        isRecentlyReadMode={isRecentlyReadMode}
                        isTodayMode={isTodayMode}
                    />
                }
                detail={
                    <ArticlesDetail
                        article={selectedArticle}
                        isLoading={false} // Loading handled by skeleton in parent if needed, or we can pass isArticlesLoading but that's for the list mostly
                        isRecentlyReadMode={isRecentlyReadMode}
                        isReadLaterMode={isReadLaterMode}
                        shouldShowPreviewBanner={shouldShowPreviewBanner}
                        onMarkAsRead={handleMarkAsRead}
                        onArticleRemoved={() => { }}
                        onBack={handleBackToList}
                    />
                }
            />

            {feedData && (
                <FeedSubscriptionModal
                    isOpen={isSubscriptionModalOpen}
                    onClose={() => setIsSubscriptionModalOpen(false)}
                    feed={feedData}
                />
            )}
        </div>
    )
}
