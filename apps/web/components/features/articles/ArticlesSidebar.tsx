import { useMemo } from "react"
import { toast } from "react-hot-toast"
import { ArticlesHeader } from "./ArticlesHeader"
import { ArticlesList } from "./ArticlesList"
import { FeedPreviewBanner } from "@/components/features/feeds/FeedPreviewBanner"
import { useArticlesStore } from "./stores/use-articles-store"
import { useArticleUnreadCount } from "./hooks/use-article-unread-count"
import {
    useUnreadCounts,
    useFeeds,
    useMarkFeedAllRead,
    useMarkFolderAllRead,
    ArticleFilterMode,
    type Article,
    type FeedDetail,
    type Subscription,
    type Folder,
} from "@readspace/shared"

interface ArticlesSidebarProps {
    // Context
    feedId?: string
    folderId?: string
    mode?: ArticleFilterMode
    initialSidebarTitle?: string

    // Data
    articles: Article[]
    isLoading: boolean
    isFetchingNextPage: boolean
    hasNextPage: boolean
    feedData?: FeedDetail

    // Actions
    fetchNextPage: () => void
    handleDeepRefresh: () => void
    isDeepRefreshing: boolean
    setIsSubscriptionModalOpen: (open: boolean) => void
}

export function ArticlesSidebar({
    feedId,
    folderId,
    mode = ArticleFilterMode.AllArticles,
    initialSidebarTitle,
    articles,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    feedData,
    fetchNextPage,
    handleDeepRefresh,
    isDeepRefreshing,
    setIsSubscriptionModalOpen,
}: ArticlesSidebarProps) {
    // Store
    const {
        showUnreadOnly,
        selectedArticleId,
        toggleUnreadFilter,
        selectArticle,
    } = useArticlesStore()

    // Data Hooks
    const { data: unreadCounts } = useUnreadCounts()
    const { data: feedsResponse } = useFeeds()
    const allUserFeeds = feedsResponse?.subscriptions || []
    const folders = feedsResponse?.folders || []

    const allFolders = useMemo(() => {
        return folders
    }, [folders])

    // Mutations
    const markFeedAllRead = useMarkFeedAllRead()
    const markFolderAllRead = useMarkFolderAllRead()

    // Derived State
    const isRecentlyReadMode = mode === ArticleFilterMode.RecentlyRead
    const isReadLaterMode = mode === ArticleFilterMode.ReadLater
    const isTodayMode = mode === ArticleFilterMode.Today

    const unreadCount = useArticleUnreadCount({
        unreadCounts,
        feedId,
        folderId,
        mode,
        allUserFeeds: allUserFeeds as Subscription[],
    })

    const sidebarTitle = useMemo(() => {
        if (isRecentlyReadMode) return "Recently Read"
        if (isReadLaterMode) return "Read Later"
        if (isTodayMode) return "Today"
        if (feedId && feedData?.title) return feedData.title
        if (folderId && allFolders) {
            return (
                (allFolders as Folder[])?.find((f) => f.id === folderId)
                    ?.name ||
                initialSidebarTitle ||
                "All Articles"
            )
        }
        return initialSidebarTitle || "All Articles"
    }, [
        isRecentlyReadMode,
        isReadLaterMode,
        isTodayMode,
        feedId,
        feedData,
        folderId,
        allFolders,
        initialSidebarTitle,
    ])

    const shouldShowPreviewBanner = !!(
        feedId &&
        feedData &&
        feedData.is_subscribed === false
    )

    // Handlers
    const handleMarkAllAsRead = async () => {
        if (!feedId && !folderId) return
        toast.loading("Marking all as read...", { id: "mark-all-read" })
        try {
            if (feedId) {
                await markFeedAllRead.mutateAsync(feedId)
            } else if (folderId) {
                await markFolderAllRead.mutateAsync(folderId)
            }
            toast.success("All articles marked as read!", {
                id: "mark-all-read",
            })
        } catch (error) {
            console.error("Mark all as read failed:", error)
            toast.error("Failed to mark all as read.", { id: "mark-all-read" })
        }
    }

    return (
        <div className="flex flex-col h-full">
            <ArticlesHeader
                sidebarTitle={sidebarTitle}
                unreadCount={unreadCount}
                showUnreadOnly={showUnreadOnly}
                isReadLaterMode={isReadLaterMode}
                feedId={feedId}
                folderId={folderId}
                isDeepRefreshing={isDeepRefreshing}
                isMarkingAllRead={
                    markFeedAllRead.isPending || markFolderAllRead.isPending
                }
                toggleShowUnreadOnly={toggleUnreadFilter}
                handleDeepRefresh={handleDeepRefresh}
                handleMarkAllAsRead={handleMarkAllAsRead}
                isPreviewMode={shouldShowPreviewBanner}
            />

            {shouldShowPreviewBanner && feedData && (
                <div className="flex-shrink-0">
                    <FeedPreviewBanner
                        feedTitle={feedData.title}
                        onFollow={() => setIsSubscriptionModalOpen(true)}
                    />
                </div>
            )}

            <div className="flex-1 overflow-hidden">
                <ArticlesList
                    articles={articles}
                    selectedArticleId={selectedArticleId}
                    isLoading={isLoading}
                    isFetchingNextPage={isFetchingNextPage}
                    hasNextPage={hasNextPage}
                    showUnreadOnly={showUnreadOnly}
                    isRecentlyReadMode={isRecentlyReadMode}
                    isReadLaterMode={isReadLaterMode}
                    isTodayMode={isTodayMode}
                    feedId={feedId}
                    folderId={folderId}
                    fetchNextPage={fetchNextPage}
                    onArticleSelect={selectArticle}
                />
            </div>
        </div>
    )
}
