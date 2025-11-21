"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import * as Dialog from "@radix-ui/react-dialog"
import { fuzzySearch, useFeeds, useFolders } from "@readspace/shared"
import { Search, Star } from "lucide-react"
import Image from "next/image"
import "./feed-search-command.scss"

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
    const [searchValue, setSearchValue] = React.useState("")
    const router = useRouter()

    // Data queries
    const { data: feeds = [] } = useFeeds()
    const { data: folders = [] } = useFolders()

    // Type-safe folder data
    const typedFolders = (folders as Array<{ id: string; name: string }>) || []

    // Filter feeds with fuzzy search (limit to 100 results for performance)
    const filteredFeeds = React.useMemo(() => {
        if (!searchValue.trim()) {
            return feeds.slice(0, 100)
        }
        return fuzzySearch(feeds, searchValue, ["title", "url"]).slice(0, 100)
    }, [feeds, searchValue])

    // Group feeds by folder (no separate favorites group)
    const groupedFeeds = React.useMemo(() => {
        const groups: Record<string, typeof feeds> = {
            no_folder: [],
        }

        // Initialize groups for each folder
        typedFolders.forEach((folder) => {
            groups[folder.id] = []
        })

        // Group feeds
        filteredFeeds.forEach((feed) => {
            // Add to folder or no_folder (no separate favorites)
            if (feed.folder_id) {
                groups[feed.folder_id]?.push(feed)
            } else {
                groups.no_folder!.push(feed)
            }
        })

        return groups
    }, [filteredFeeds, typedFolders])

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
    const handleClose = () => {
        onClose()
        setSearchValue("")
    }

    return (
        <Command.Dialog
            open={isOpen}
            onOpenChange={handleClose}
            label="Feed Search"
        >
            <Dialog.Title className="sr-only">Search Feeds</Dialog.Title>
            <div cmdk-framer-header="">
                <Search />
                <Command.Input
                    value={searchValue}
                    onValueChange={setSearchValue}
                    placeholder="Search my subscriptions..."
                />
            </div>

            <Command.List>
                <Command.Empty>No feeds found.</Command.Empty>

                {/* Folder groups */}
                {typedFolders.map((folder) => {
                    const folderFeeds = groupedFeeds[folder.id] || []
                    if (folderFeeds.length === 0) return null

                    return (
                        <Command.Group key={folder.id} heading={folder.name}>
                            {folderFeeds.map((feed) => (
                                <Command.Item
                                    key={feed.id}
                                    value={`${feed.title} ${feed.link || feed.url}`}
                                    onSelect={() => handleSelectFeed(feed.id)}
                                >
                                    <div cmdk-framer-icon-wrapper="">
                                        {feed.image_url ? (
                                            <Image
                                                src={feed.image_url}
                                                alt=""
                                                width={32}
                                                height={32}
                                            />
                                        ) : (
                                            <div className="feed-placeholder" />
                                        )}
                                    </div>
                                    <div cmdk-framer-item-meta="">
                                        <span>{feed.title}</span>
                                        {feed.link && (
                                            <span cmdk-framer-item-subtitle="">
                                                {feed.link}
                                            </span>
                                        )}
                                    </div>
                                    {feed.is_favorite && (
                                        <Star className="feed-star-icon" />
                                    )}
                                    {feed.unread_count != null &&
                                        feed.unread_count > 0 && (
                                            <kbd cmdk-framer-badge="">
                                                {feed.unread_count}
                                            </kbd>
                                        )}
                                </Command.Item>
                            ))}
                        </Command.Group>
                    )
                })}

                {/* No folder group */}
                {groupedFeeds.no_folder &&
                    groupedFeeds.no_folder.length > 0 && (
                        <Command.Group heading="No Folder">
                            {groupedFeeds.no_folder.map((feed) => (
                                <Command.Item
                                    key={feed.id}
                                    value={`${feed.title} ${feed.link || feed.url}`}
                                    onSelect={() => handleSelectFeed(feed.id)}
                                >
                                    <div cmdk-framer-icon-wrapper="">
                                        {feed.image_url ? (
                                            <Image
                                                src={feed.image_url}
                                                alt=""
                                                width={32}
                                                height={32}
                                            />
                                        ) : (
                                            <div className="feed-placeholder" />
                                        )}
                                    </div>
                                    <div cmdk-framer-item-meta="">
                                        <span>{feed.title}</span>
                                        {feed.link && (
                                            <span cmdk-framer-item-subtitle="">
                                                {feed.link}
                                            </span>
                                        )}
                                    </div>
                                    {feed.is_favorite && (
                                        <Star className="feed-star-icon" />
                                    )}
                                    {feed.unread_count != null &&
                                        feed.unread_count > 0 && (
                                            <kbd cmdk-framer-badge="">
                                                {feed.unread_count}
                                            </kbd>
                                        )}
                                </Command.Item>
                            ))}
                        </Command.Group>
                    )}
            </Command.List>
        </Command.Dialog>
    )
}
