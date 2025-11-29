"use client"

import { Button } from "@/components/ui/button"
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    useSidebarLeft,
} from "@/components/ui/sidebar"
import {
    BookmarkIcon,
    Compass,
    Diamond,
    FolderPlus,
    Search,
    Settings2,
} from "lucide-react"
import Link from "next/link"
import { FeedSearchCommand } from "./FeedSearchCommand"
import { CollapsibleFeedItem } from "./items/CollapsibleFeedItem"
import {
    MainNavigationItems,
    type MainNavItem,
} from "./items/MainNavigationItems"
import { RegularFeedItem } from "./items/RegularFeedItem"
import { SubFeedItem, type SubFeedItemData } from "./items/SubFeedItem"
import { FeedModal } from "./modals/FeedModal"
import { FolderModal } from "./modals/FolderModal"
import { SidebarFeedsSkeleton } from "./SidebarSkeleton"
import { useFeedsNavigation } from "./hooks/use-feeds-navigation"

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
    const {
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
    } = useFeedsNavigation()

    return (
        <SidebarGroup className="mt-2">
            {/* Favorites section */}
            {!isSidebarLoading && favoriteFeedItems.length > 0 && (
                <div className="mb-6">
                    <SidebarGroupLabel>Pinned</SidebarGroupLabel>
                    <SidebarMenu>
                        {favoriteFeedItems.map(
                            (feed: SubFeedItemData, index: number) => (
                                <SubFeedItem
                                    key={feed.id}
                                    item={feed}
                                    index={index}
                                    disableAnimation={true}
                                />
                            )
                        )}
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
                    handleClearFeedError()
                }}
                selectedFolderId={selectedFolderId}
                folders={typedFolders}
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
export function SidebarMain() {
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
