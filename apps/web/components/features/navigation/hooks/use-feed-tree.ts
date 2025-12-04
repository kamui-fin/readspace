import { useFeeds, useUnreadCounts, type Subscription } from "@readspace/shared"
import { usePathname } from "next/navigation"
import { useMemo } from "react"
import type { CollapsibleFeedItemData } from "../items/CollapsibleFeedItem"
import type { RegularFeedItemData } from "../items/RegularFeedItem"
import type { SubFeedItemData } from "../items/SubFeedItem"

// Combined feed item type for rendering
export type FeedItem = CollapsibleFeedItemData | RegularFeedItemData

export function useFeedTree() {
    // Data queries - using global defaults for caching
    const { data: feedsResponse, isLoading: isFeedsLoading } = useFeeds()
    const { data: unreadCounts } = useUnreadCounts()
    const pathname = usePathname()

    // Memoized type-safe data transformations
    const typedFolders = useMemo(() => {
        return feedsResponse?.folders || []
    }, [feedsResponse])

    const typedFeeds = useMemo(() => {
        const feeds = feedsResponse?.subscriptions || []
        return ((feeds as unknown as Subscription[]) || []).map(
            (subscription) => ({
                id: subscription.feed.id,
                title: subscription.custom_title || subscription.feed.title,
                url: subscription.feed.url,
                folder_id: subscription.folder?.id || null,
                image_url: subscription.feed.image_url || undefined,
                is_favorite: subscription.is_favorite,
                unread_count:
                    unreadCounts?.feed_counts[subscription.feed.id] ?? 0,
                // Keep the subscription ID for operations that need it
                subscription_id: subscription.id,
            })
        )
    }, [feedsResponse, unreadCounts])

    const typedUnreadCounts = useMemo(() => {
        const counts =
            (unreadCounts as {
                total_unread?: number
                read_later?: number
                today?: number
            }) || {}

        // Calculate per-folder counts from feedUnreadCounts
        const unread_by_folder: Record<string, number> = {}
        typedFeeds.forEach((feed) => {
            if (feed.folder_id) {
                unread_by_folder[feed.folder_id] =
                    (unread_by_folder[feed.folder_id] || 0) +
                    (feed.unread_count || 0)
            }
        })

        // Calculate total unread from all feeds
        const totalUnread = typedFeeds.reduce(
            (sum, feed) => sum + (feed.unread_count || 0),
            0
        )

        return {
            ...counts,
            unread_by_folder,
            calculated_total_unread: totalUnread,
        }
    }, [unreadCounts, typedFeeds])

    // Group feeds by folder
    const feedsByFolder = useMemo(() => {
        const result: Record<string, typeof typedFeeds> = {}

        // Initialize with empty arrays for each folder
        typedFolders.forEach((folder) => {
            result[folder.id] = []
        })

        // Add "No Folder" category
        result["no_folder"] = []

        // Populate feeds into their folders
        typedFeeds.forEach((feed) => {
            if (feed.folder_id) {
                result[feed.folder_id]?.push(feed)
            } else {
                result["no_folder"]?.push(feed)
            }
        })

        return result
    }, [typedFolders, typedFeeds])

    // Extract favorited feeds for separate rendering
    const favoriteFeedItems: SubFeedItemData[] = useMemo(() => {
        const favorites = typedFeeds
            .filter((feed) => feed.is_favorite)
            .map((feed) => ({
                id: feed.id,
                title: feed.title,
                url: `/feeds/${feed.id}/articles`,
                count: feed.unread_count ?? null,
                image: feed.image_url || undefined,
                isActive: pathname === `/feeds/${feed.id}/articles`,
                // Keep isFavorite true for correct context menu behavior
                // Star icon is hidden via isPinned flag
                isFavorite: true,
                isPinned: true,
            }))

        // Sort favorites by title
        return favorites.sort((a, b) => a.title.localeCompare(b.title))
    }, [typedFeeds, pathname])

    // Transform data for rendering
    const feedItems: FeedItem[] = useMemo(() => {
        const items: FeedItem[] = []

        // Extract feed id from pathname if we're viewing a feed
        const feedIdFromPath = pathname.match(/\/feeds\/([^/]+)\/articles/)?.[1]

        // Find the parent folder of the current feed if we're viewing a feed
        const currentFeedParentFolder = feedIdFromPath
            ? typedFeeds.find((feed) => feed.id === feedIdFromPath)?.folder_id
            : null

        // Add "All" item
        items.push({
            id: "all",
            title: "All",
            url: "/articles",
            count: typedUnreadCounts?.calculated_total_unread || 0,
            icon: null, // Will be handled specially in RegularFeedItem
            isActive: pathname === "/articles",
            isFavorite: false,
        })

        // Add folder items (collapsible)
        typedFolders.forEach((folder) => {
            const folderFeeds = feedsByFolder[folder.id] || []
            const folderUnreadCount =
                typedUnreadCounts?.unread_by_folder?.[folder.id] ?? null

            // Determine if this folder should be open
            const isViewingThisFolder =
                pathname === `/folders/${folder.id}/articles`
            const isViewingFeedInThisFolder =
                folder.id === currentFeedParentFolder
            const shouldBeOpen =
                isViewingThisFolder || isViewingFeedInThisFolder

            items.push({
                id: folder.id,
                title: folder.name,
                url: `/folders/${folder.id}/articles`,
                count: folderUnreadCount,
                icon: null,
                isCollapsible: true,
                isOpen: shouldBeOpen,
                isActive: pathname === `/folders/${folder.id}/articles`,
                isFavorite: false,
                items: folderFeeds.map((feed) => ({
                    id: feed.id,
                    title: feed.title,
                    url: `/feeds/${feed.id}/articles`,
                    count: feed.unread_count ?? null,
                    image: feed.image_url || undefined,
                    isActive: pathname === `/feeds/${feed.id}/articles`,
                    isFavorite: feed.is_favorite || false,
                })),
            } as CollapsibleFeedItemData)
        })

        // Add "No Folder" feeds (regular items)
        feedsByFolder["no_folder"]?.forEach((feed) => {
            items.push({
                id: feed.id,
                title: feed.title,
                url: `/feeds/${feed.id}/articles`,
                count: feed.unread_count ?? null,
                icon: null,
                isActive: pathname === `/feeds/${feed.id}/articles`,
                isFavorite: feed.is_favorite || false,
            })
        })

        return items
    }, [typedFolders, typedFeeds, feedsByFolder, typedUnreadCounts, pathname])

    return {
        isFoldersLoading: isFeedsLoading,
        typedFolders,
        favoriteFeedItems,
        feedItems,
    }
}
