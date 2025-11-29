import { useMemo, useState } from "react"
import { toast } from "react-hot-toast"

import {
    useFeed,
    useFeeds,
    useFolders,
    useRefreshFeed,
    useUnreadCounts,
    useUpdateArticle,
    useMarkFeedAllRead,
    useMarkFolderAllRead,
    type Subscription,
    type Folder,
} from "@readspace/shared"
import { useArticlesData } from "./hooks/useArticlesData"
import { useArticlesView } from "./hooks/useArticlesView"
import { useArticleUnreadCount } from "./hooks/useArticleUnreadCount"
import { useIsMobile } from "@/hooks/useMobile"

interface UseArticlesControllerProps {
    initialSidebarTitle?: string
    feedId?: string
    folderId?: string
    publishedSince?: string
    publishedUntil?: string
    mode?: "allArticles" | "recentlyRead" | "readLater" | "today"
    onCreateFolder?: () => void
    onAddFeed?: (folderId?: string) => void
}

export function useArticlesController({
    initialSidebarTitle,
    feedId,
    folderId,
    publishedSince,
    publishedUntil,
    mode = "allArticles",
}: UseArticlesControllerProps) {
    // Component state
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] =
        useState(false)

    // Hooks
    const isMobile = useIsMobile()


    // Data queries
    const { data: allUserFeeds } = useFeeds({})
    const { data: allFolders } = useFolders({ enabled: !!folderId })
    const { data: unreadCounts } = useUnreadCounts()

    // Mutations
    const updateArticle = useUpdateArticle()
    const refreshFeed = useRefreshFeed()
    const markFeedAllRead = useMarkFeedAllRead()
    const markFolderAllRead = useMarkFolderAllRead()

    // View mode flags
    const isRecentlyReadMode = mode === "recentlyRead"
    const isReadLaterMode = mode === "readLater"
    const isTodayMode = mode === "today"

    // Fetch feed data
    const {
        data: feedData,
        error: feedError,
        isLoading: isFeedLoading,
    } = useFeed(feedId || "", {
        enabled: !!feedId,
    })

    // Use custom hook for data fetching
    const {
        articles: allArticles,
        isLoading: isArticlesLoading,
        isFetching,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage,
        refetch: refetchArticles,
    } = useArticlesData({
        mode,
        feedId,
        folderId,
        publishedSince,
        publishedUntil,
    })

    // Use custom hook for view logic
    const {
        selectedArticleId,
        selectedArticle,
        showContent,
        showUnreadOnly,
        filteredArticles,
        handleArticleSelect,
        handleBackToList,
        toggleShowUnreadOnly,
    } = useArticlesView({
        articles: allArticles,
        isArticlesLoading,
        isFetching,
        feedId,
        folderId,
        mode,
    })

    // Determine sidebar title
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

    // Calculate unread count using custom hook
    const unreadCount = useArticleUnreadCount({
        unreadCounts,
        feedId,
        folderId,
        mode,
        allUserFeeds: allUserFeeds as Subscription[],
    })

    // Determine if we should show preview banner
    const shouldShowPreviewBanner = !!(
        feedId &&
        feedData &&
        feedData.is_subscribed === false
    )

    // Handlers
    const handleRefreshWithMessage = async (message: string) => {
        toast.loading(message, { id: "refresh" })
        try {
            await refetchArticles()
            toast.success("Articles refreshed!", { id: "refresh" })
        } catch (error) {
            console.error("Refresh failed:", error)
            toast.error("Failed to refresh articles.", { id: "refresh" })
        }
    }

    const handleDeepRefresh = async () => {
        if (!feedId) return
        toast.loading("Checking for new articles...", { id: "deep-refresh" })
        try {
            await refreshFeed.mutateAsync({ feedId, forceRefetch: true })
            await refetchArticles()
            toast.success("Check complete! Articles updated.", {
                id: "deep-refresh",
            })
        } catch (error) {
            console.error("Deep refresh failed:", error)
            toast.error("Failed to check for new articles.", {
                id: "deep-refresh",
            })
        }
    }

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

    const handleMarkAsRead = () => {
        if (!selectedArticle) return
        updateArticle.mutate({
            articleId: selectedArticle.id,
            data: { is_read: true },
        })
    }

    return {
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
        isDeepRefreshing: refreshFeed.isPending,
        isMarkingAllRead:
            markFeedAllRead.isPending || markFolderAllRead.isPending,

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
    }
}
