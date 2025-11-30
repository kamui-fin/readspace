"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import { Search, Star } from "lucide-react"
import { useFeedSearch } from "./hooks/use-feed-search"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { FeedIcon } from "@/components/features/feeds/FeedIcon"

interface FeedSearchCommandProps {
    /** Whether the command palette is open */
    isOpen: boolean
    /** Callback to close the command palette */
    onClose: () => void
    /** Whether to close sidebar on mobile after selection */
    isMobile?: boolean
    /** Callback to close sidebar */
    onCloseSidebar?: () => void
}

/**
 * Command palette for searching through all feeds with fuzzy search.
 * Displays feeds grouped by folder with keyboard navigation support.
 */
export function FeedSearchCommand({
    isOpen,
    onClose,
    isMobile,
    onCloseSidebar,
}: FeedSearchCommandProps) {
    const router = useRouter()
    const {
        searchValue,
        setSearchValue,
        typedFolders,
        groupedFeeds,
        feedUnreadCounts,
    } = useFeedSearch()

    /**
     * Handle feed selection
     */
    const handleSelectFeed = (feedId: string) => {
        router.push(`/feeds/${feedId}/articles`)

        // Close sidebar on mobile
        if (isMobile && onCloseSidebar) {
            onCloseSidebar()
        }

        // Close command palette
        onClose()
        setSearchValue("")
    }

    /**
     * Reset search when closing
     */
    const handleClose = (open: boolean) => {
        if (!open) {
            onClose()
            setSearchValue("")
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="p-0 max-w-2xl overflow-hidden shadow-2xl [&>button]:hidden">
                <DialogTitle className="sr-only">Search Feeds</DialogTitle>
                <Command className="flex h-full w-full flex-col overflow-hidden rounded-xl bg-background">
                    <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Command.Input
                            value={searchValue}
                            onValueChange={setSearchValue}
                            placeholder="Search my subscriptions..."
                            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>

                    <Command.List className="max-h-[400px] overflow-y-auto overflow-x-hidden p-2">
                        <Command.Empty className="py-6 text-center text-sm">
                            No feeds found.
                        </Command.Empty>

                        {/* Folder groups */}
                        {typedFolders.map((folder) => {
                            const folderFeeds = groupedFeeds[folder.id] || []
                            if (folderFeeds.length === 0) return null

                            return (
                                <Command.Group
                                    key={folder.id}
                                    heading={folder.name}
                                    className="overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                                >
                                    {folderFeeds.map((feed) => {
                                        const unreadCount =
                                            feedUnreadCounts?.[feed.feed.id] || 0
                                        return (
                                            <Command.Item
                                                key={feed.id}
                                                value={`${feed.custom_title || feed.feed.title} ${feed.feed.link || feed.feed.url}`}
                                                onSelect={() =>
                                                    handleSelectFeed(feed.feed.id)
                                                }
                                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                                            >
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md mr-3">
                                                    <FeedIcon
                                                        feed={{
                                                            title: feed.custom_title || feed.feed.title,
                                                            image_url: feed.feed.image_url,
                                                        }}
                                                        className="h-full w-full rounded-md"
                                                    />
                                                </div>
                                                <div className="flex flex-col flex-1 min-w-0 mr-2">
                                                    <span className="truncate font-medium">
                                                        {feed.custom_title ||
                                                            feed.feed.title}
                                                    </span>
                                                    {feed.feed.link && (
                                                        <span className="truncate text-xs text-muted-foreground">
                                                            {feed.feed.link}
                                                        </span>
                                                    )}
                                                </div>
                                                {feed.is_favorite && (
                                                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 mr-2" />
                                                )}
                                                {unreadCount > 0 && (
                                                    <span className="ml-auto text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                                                        {unreadCount}
                                                    </span>
                                                )}
                                            </Command.Item>
                                        )
                                    })}
                                </Command.Group>
                            )
                        })}

                        {/* No folder group */}
                        {groupedFeeds.no_folder &&
                            groupedFeeds.no_folder.length > 0 && (
                                <Command.Group
                                    heading="No Folder"
                                    className="overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                                >
                                    {groupedFeeds.no_folder.map((feed) => {
                                        const unreadCount =
                                            feedUnreadCounts?.[feed.feed.id] || 0
                                        return (
                                            <Command.Item
                                                key={feed.id}
                                                value={`${feed.custom_title || feed.feed.title} ${feed.feed.link || feed.feed.url}`}
                                                onSelect={() =>
                                                    handleSelectFeed(feed.feed.id)
                                                }
                                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                                            >
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md mr-3">
                                                    <FeedIcon
                                                        feed={{
                                                            title: feed.custom_title || feed.feed.title,
                                                            image_url: feed.feed.image_url,
                                                        }}
                                                        className="h-full w-full rounded-md"
                                                    />
                                                </div>
                                                <div className="flex flex-col flex-1 min-w-0 mr-2">
                                                    <span className="truncate font-medium">
                                                        {feed.custom_title ||
                                                            feed.feed.title}
                                                    </span>
                                                    {feed.feed.link && (
                                                        <span className="truncate text-xs text-muted-foreground">
                                                            {feed.feed.link}
                                                        </span>
                                                    )}
                                                </div>
                                                {feed.is_favorite && (
                                                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 mr-2" />
                                                )}
                                                {unreadCount > 0 && (
                                                    <span className="ml-auto text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                                                        {unreadCount}
                                                    </span>
                                                )}
                                            </Command.Item>
                                        )
                                    })}
                                </Command.Group>
                            )}
                    </Command.List>
                </Command>
            </DialogContent>
        </Dialog>
    )
}
