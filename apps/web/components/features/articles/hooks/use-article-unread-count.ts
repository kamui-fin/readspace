import { useMemo } from "react"
import { type Subscription, ArticleFilterMode } from "@readspace/shared"

interface UseArticleUnreadCountProps {
    unreadCounts:
        | {
              read_later?: number
              today?: number
              feed_counts?: Record<string, number>
              total_unread?: number
          }
        | null
        | undefined
    feedId?: string
    folderId?: string
    mode?: ArticleFilterMode
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
        if (mode === ArticleFilterMode.RecentlyRead) return 0

        if (mode === ArticleFilterMode.ReadLater)
            return typedUnreadCounts?.read_later || 0
        if (mode === ArticleFilterMode.Today)
            return typedUnreadCounts?.today || 0

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
