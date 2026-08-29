import { useMemo } from "react"
import { type Subscription, ArticleFilterMode } from "@readspace/shared"

interface UseArticleUnreadCountProps {
    unreadCounts:
        | {
              read_later?: number
              today?: number
              feed_counts?: Record<string, number>
          }
        | null
        | undefined
    feedId?: string
    folderId?: string
    mode?: ArticleFilterMode
    allUserFeeds: Subscription[] | null
}

/**
 * Resolves the unread badge count shown in the articles header for the current
 * view (a single feed, a folder, one of the special modes, or "All Articles").
 *
 * The `/api/articles/counts` endpoint only returns per-feed counts plus the
 * `read_later` / `today` totals — there is no server-side aggregate for "all"
 * or per-folder. Both are derived here by summing `feed_counts`, mirroring the
 * sidebar tree (`use-feed-tree.ts`) so the header and nav always agree.
 */
export function useArticleUnreadCount({
    unreadCounts,
    feedId,
    folderId,
    mode,
    allUserFeeds,
}: UseArticleUnreadCountProps) {
    return useMemo(() => {
        const typedUnreadCounts = unreadCounts || {}
        const feedCounts = typedUnreadCounts.feed_counts ?? {}

        // No unread counts for recently read
        if (mode === ArticleFilterMode.RecentlyRead) return 0

        if (mode === ArticleFilterMode.ReadLater)
            return typedUnreadCounts?.read_later || 0
        if (mode === ArticleFilterMode.Today)
            return typedUnreadCounts?.today || 0

        if (feedId) return feedCounts[feedId] || 0

        if (folderId && allUserFeeds) {
            const feedIdsInFolder = new Set(
                allUserFeeds
                    .filter((s) => s.folder?.id === folderId)
                    .map((s) => s.feed.id)
            )
            return Object.entries(feedCounts).reduce(
                (acc, [id, count]) =>
                    acc + (feedIdsInFolder.has(id) ? count || 0 : 0),
                0
            )
        }

        // "All Articles": sum every per-feed unread count.
        return Object.values(feedCounts).reduce(
            (acc, count) => acc + (count || 0),
            0
        )
    }, [unreadCounts, mode, feedId, folderId, allUserFeeds])
}
