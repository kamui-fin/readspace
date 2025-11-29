import { useMemo } from "react"
import type { Subscription } from "@readspace/shared"

interface UseArticleUnreadCountProps {
    unreadCounts: {
        read_later_count?: number
        today_count?: number
        feed_counts?: Record<string, number>
        total_unread?: number
    } | null | undefined
    feedId?: string
    folderId?: string
    mode?: "allArticles" | "recentlyRead" | "readLater" | "today"
    allUserFeeds: Subscription[] | null
}

export function useArticleUnreadCount({
    unreadCounts,
    feedId,
    folderId,
    mode,
    allUserFeeds,
}: UseArticleUnreadCountProps) {
    return useMemo(() => {
        const typedUnreadCounts = unreadCounts || {}

        // No unread counts for recently read
        if (mode === "recentlyRead") return 0

        if (mode === "readLater")
            return typedUnreadCounts?.read_later_count || 0
        if (mode === "today") return typedUnreadCounts?.today_count || 0

        if (feedId) return unreadCounts?.feed_counts?.[feedId] || 0

        if (folderId && allUserFeeds) {
            const feedsInFolder = allUserFeeds.filter(
                (s) => s.folder?.id === folderId
            )
            return feedsInFolder.reduce(
                (acc, sub) =>
                    acc + (unreadCounts?.feed_counts?.[sub.feed.id] || 0),
                0
            )
        }

        return typedUnreadCounts?.total_unread || 0
    }, [unreadCounts, mode, feedId, folderId, allUserFeeds])
}
