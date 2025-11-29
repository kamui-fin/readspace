import { useModalStore } from "@/stores/modal-store"
import {
    useFeeds,
    useFolders,
    useUnreadCounts,
    type Folder,
    type Subscription,
} from "@readspace/shared"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import type { CollapsibleFeedItemData } from "../items/CollapsibleFeedItem"
import type { RegularFeedItemData } from "../items/RegularFeedItem"
import type { SubFeedItemData } from "../items/SubFeedItem"

// Combined feed item type for rendering
export type FeedItem = CollapsibleFeedItemData | RegularFeedItemData

export function useFeedsNavigation() {
    // Data queries - using global defaults for caching
    const { data: folders, isLoading: isFoldersLoading } = useFolders()
    const { data: feeds } = useFeeds({})
    const { data: unreadCounts } = useUnreadCounts()

    // Loading state
    const isSidebarLoading = isFoldersLoading

    // Navigation and mutations
    const pathname = usePathname()

    // Modal state management
    const { isFolderModalOpen, openFolderModal, closeFolderModal } =
        useModalStore()
    const [isFeedModalOpen, setIsFeedModalOpen] = useState(false)
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
        null
    )
    const [feedError, setFeedError] = useState<string | null>(null)
    const [isSearchOpen, setIsSearchOpen] = useState(false)

    // Keyboard shortcut for search (Cmd+K or Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault()
                setIsSearchOpen(true)
            }
        }

        document.addEventListener("keydown", handleKeyDown)
        return () => document.removeEventListener("keydown", handleKeyDown)
    }, [])

    // Memoized type-safe data transformations
    const typedFolders = useMemo(() => (folders as Folder[]) || [], [folders])
    const typedFeeds = useMemo(
        () =>
            ((feeds as unknown as Subscription[]) || []).map(
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
            ),
        [feeds, unreadCounts]
    )
    const typedUnreadCounts = useMemo(() => {
        const counts =
            (unreadCounts as {
                total_unread?: number
                read_later_count?: number
                today_count?: number
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

        return {
            ...counts,
            unread_by_folder,
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
        const favorites: SubFeedItemData[] = []

        // Get all favorited feeds
        const favoritedFeeds = typedFeeds.filter((feed) => feed.is_favorite)

        // Transform favorites into SubFeedItemData
        favoritedFeeds.forEach((feed) => {
            favorites.push({
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
            })
        })

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
            count: typedUnreadCounts?.total_unread || 0,
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

    /**
     * Handle adding a new folder
     */
    const handleAddFolder = () => {
        openFolderModal()
    }

    /**
     * Handle adding a new feed to a specific folder
     */
    const handleAddFeed = (folderId: string) => {
        setSelectedFolderId(folderId)
        setFeedError(null)
        setIsFeedModalOpen(true)
    }

    /**
     * Clear feed modal state
     */
    const handleClearFeedError = () => {
        setFeedError(null)
    }

    return {
        isSidebarLoading,
        favoriteFeedItems,
        feedItems,
        typedFolders,
        isFolderModalOpen,
        closeFolderModal,
        isFeedModalOpen,
        setIsFeedModalOpen,
        selectedFolderId,
        setSelectedFolderId,
        feedError,
        handleClearFeedError,
        isSearchOpen,
        setIsSearchOpen,
        handleAddFolder,
        handleAddFeed,
    }
}
