"use client"

import { Button } from "@/components/ui/button"
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    useSidebarLeft,
} from "@/components/ui/sidebar"
import { useModalStore } from "@/lib/stores/modal-store"
import { useFeeds, useFeedUnreadCounts, useFolders, useUnreadCounts } from "@readspace/shared"
import {
    BookmarkIcon,
    Compass,
    Diamond,
    FolderPlus,
    Search,
    Settings2,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"
import { useState } from "react"
import { FeedSearchCommand } from "./FeedSearchCommand"
import {
    CollapsibleFeedItem,
    type CollapsibleFeedItemData,
} from "./items/CollapsibleFeedItem"
import {
    MainNavigationItems,
    type MainNavItem,
} from "./items/MainNavigationItems"
import {
    RegularFeedItem,
    type RegularFeedItemData,
} from "./items/RegularFeedItem"
import { SubFeedItem, type SubFeedItemData } from "./items/SubFeedItem"
import { FeedModal } from "./modals/FeedModal"
import { FolderModal } from "./modals/FolderModal"
import { SidebarFeedsSkeleton } from "./SidebarSkeleton"

// Combined feed item type for rendering
type FeedItem = CollapsibleFeedItemData | RegularFeedItemData

/**
 * Feeds navigation component that displays the user's RSS feeds organized by folders.
 * Handles feed/folder creation, deletion, and navigation with optimistic updates.
 */
export function FeedsNavigation({
    isMobile,
    toggleSidebar,
}: {
    isMobile: boolean
    toggleSidebar: () => void
}) {
    // Data queries - using global defaults for caching
    const { data: folders, isLoading: isFoldersLoading } = useFolders()
    const { data: feeds, isLoading: isFeedsLoading } = useFeeds({})
    const { data: unreadCounts } = useUnreadCounts()
    const { data: feedUnreadCounts } = useFeedUnreadCounts()

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
    React.useEffect(() => {
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
    const typedFolders = React.useMemo(
        () => (folders as Array<{ id: string; name: string }>) || [],
        [folders]
    )
    const typedFeeds = React.useMemo(
        () =>
            ((feeds as Array<{
                id: string
                title: string
                folder_id: string | null
                image_url?: string
                is_favorite?: boolean
            }>) || []).map(feed => ({
                ...feed,
                unread_count: feedUnreadCounts?.[feed.id] ?? 0
            })),
        [feeds, feedUnreadCounts]
    )
    const typedUnreadCounts = React.useMemo(
        () => {
            const counts = (unreadCounts as {
                total_unread?: number
                read_later_count?: number
                today_count?: number
            }) || {}

            // Calculate per-folder counts from feedUnreadCounts
            const unread_by_folder: Record<string, number> = {}
            typedFeeds.forEach(feed => {
                if (feed.folder_id) {
                    unread_by_folder[feed.folder_id] = (unread_by_folder[feed.folder_id] || 0) + (feed.unread_count || 0)
                }
            })

            return {
                ...counts,
                unread_by_folder
            }
        },
        [unreadCounts, typedFeeds]
    )

    // Group feeds by folder
    const feedsByFolder = React.useMemo(() => {
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
    const favoriteFeedItems: SubFeedItemData[] = React.useMemo(() => {
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
    const feedItems: FeedItem[] = React.useMemo(() => {
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

    return (
        <SidebarGroup className="mt-2">
            {/* Favorites section */}
            {!isSidebarLoading && favoriteFeedItems.length > 0 && (
                <div className="mb-6">
                    <SidebarGroupLabel>Pinned</SidebarGroupLabel>
                    <SidebarMenu>
                        {favoriteFeedItems.map((feed, index) => (
                            <SubFeedItem
                                key={feed.id}
                                item={feed}
                                index={index}
                                disableAnimation={true}
                            />
                        ))}
                    </SidebarMenu>
                </div>
            )}

            {/* Header with actions */}
            <div className="flex items-center justify-between pr-2">
                <SidebarGroupLabel>Feeds</SidebarGroupLabel>
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 transition-all duration-150 hover:bg-[hsl(var(--nav-hover))] rounded-full"
                        onClick={() => setIsSearchOpen(true)}
                        title="Search feeds (Cmd/Ctrl + K)"
                    >
                        <Search className="h-4 w-4 transition-colors duration-150" />
                        <span className="sr-only">Search</span>
                    </Button>
                    <Link href="/manage-feeds">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 transition-all duration-150 hover:bg-[hsl(var(--nav-hover))] rounded-full"
                            title="Manage Feeds"
                            onClick={() => {
                                if (isMobile) {
                                    toggleSidebar()
                                }
                            }}
                        >
                            <Settings2 className="h-4 w-4 transition-colors duration-150" />
                            <span className="sr-only">Settings</span>
                        </Button>
                    </Link>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 transition-all duration-150 hover:bg-[hsl(var(--nav-hover))] rounded-full"
                        onClick={handleAddFolder}
                        title="Add new folder"
                    >
                        <FolderPlus className="h-4 w-4 transition-colors duration-150" />
                        <span className="sr-only">Add</span>
                    </Button>
                </div>
            </div>

            {/* Feed items */}
            <SidebarMenu>
                {isSidebarLoading ? (
                    <SidebarFeedsSkeleton />
                ) : (
                    feedItems.map((feed) =>
                        "isCollapsible" in feed && feed.isCollapsible ? (
                            <CollapsibleFeedItem
                                key={feed.id}
                                feed={feed}
                                onAddFeed={handleAddFeed}
                                isMobile={isMobile}
                                toggleSidebar={toggleSidebar}
                            />
                        ) : (
                            <RegularFeedItem key={feed.id} feed={feed} />
                        )
                    )
                )}
            </SidebarMenu>

            {/* Modals */}
            <FolderModal
                isOpen={isFolderModalOpen}
                onClose={closeFolderModal}
            />

            <FeedModal
                isOpen={isFeedModalOpen}
                onClose={() => {
                    setIsFeedModalOpen(false)
                    setSelectedFolderId(null)
                    setFeedError(null)
                }}
                selectedFolderId={selectedFolderId}
                folders={typedFolders.map((f) => ({
                    id: f.id,
                    name: f.name,
                }))}
                error={feedError}
                onClearError={handleClearFeedError}
            />

            {/* Search command palette */}
            <FeedSearchCommand
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                isMobile={isMobile}
                onCloseSidebar={toggleSidebar}
            />
        </SidebarGroup>
    )
}

/**
 * Main navigation component that combines all navigation sections.
 * Provides a clean interface for RSS feed management and reading.
 */
export function NavMain() {
    const { isMobile, toggleSidebar } = useSidebarLeft()

    const mainNavItems: MainNavItem[] = [
        { title: "Today", icon: Diamond, url: "/today" },
        { title: "Follow Sources", icon: Compass, url: "/discover" },
        { title: "Read Later", icon: BookmarkIcon, url: "/read-later" },
    ]

    return (
        <>
            <MainNavigationItems
                items={mainNavItems}
                isMobile={isMobile}
                toggleSidebar={toggleSidebar}
            />
            <FeedsNavigation
                isMobile={isMobile}
                toggleSidebar={toggleSidebar}
            />
        </>
    )
}
