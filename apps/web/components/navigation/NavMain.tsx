"use client"

import { Button } from "@/components/ui/button"
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarLeftMenuButton,
    SidebarMenu,
    SidebarMenuItem,
    useSidebarLeft,
} from "@/components/ui/sidebar"
import { useFeeds, useFolders, useUnreadCounts } from "@readspace/shared"
import { useModalStore } from "@/lib/stores/modal-store"
import {
    BookmarkIcon,
    BookOpen,
    Compass,
    Diamond,
    FolderPlus,
    Settings2,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"
import { useState } from "react"
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
    // Data queries with optimized cache configuration
    const { data: folders, isLoading: isFoldersLoading } = useFolders({
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
    const { data: feeds, isLoading: isFeedsLoading } = useFeeds(
        {},
        {
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000, // 5 minutes
        }
    )
    const { data: unreadCounts, isLoading: isUnreadCountsLoading } =
        useUnreadCounts(undefined, {
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000, // 5 minutes
        })

    // Loading state
    const isSidebarLoading =
        isFoldersLoading || isFeedsLoading || isUnreadCountsLoading

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

    // Memoized type-safe data transformations
    const typedFolders = React.useMemo(
        () => (folders as Array<{ id: string; name: string }>) || [],
        [folders]
    )
    const typedFeeds = React.useMemo(
        () =>
            (feeds as Array<{
                id: string
                title: string
                folder_id: string | null
                unread_count?: number
                image_url?: string
                is_favorite?: boolean
            }>) || [],
        [feeds]
    )
    const typedUnreadCounts = React.useMemo(
        () =>
            (unreadCounts as {
                total_unread?: number
                unread_by_folder?: Record<string, number>
            }) || {},
        [unreadCounts]
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
            {/* Header with actions */}
            <div className="flex items-center justify-between pr-2">
                <SidebarGroupLabel>Feeds</SidebarGroupLabel>
                <div>
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
