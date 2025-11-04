"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
    SidebarLeftMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
} from "@/components/ui/sidebar"
import { ChevronRight } from "lucide-react"
import { SubFeedItem, type SubFeedItemData } from "./SubFeedItem"
import { FeedDropdownMenu } from "../menus/FeedContextMenu"

interface CollapsibleFeedItemData {
    /** Unique identifier for the folder */
    id: string
    /** Display title of the folder */
    title: string
    /** URL path for navigation */
    url: string
    /** Unread count for the folder */
    count: number | null
    /** Icon component for the folder */
    icon: React.ElementType | null
    /** Whether this folder is currently active */
    isActive: boolean
    /** Whether this folder is collapsible */
    isCollapsible?: boolean
    /** Whether this folder is initially open */
    isOpen?: boolean
    /** Whether this folder is favorited */
    isFavorite: boolean
    /** Sub-feeds within this folder */
    items?: SubFeedItemData[]
}

interface CollapsibleFeedItemProps {
    /** Feed/folder data object */
    feed: CollapsibleFeedItemData
    /** Callback for adding a new feed to this folder */
    onAddFeed: (folderId: string) => void
    /** Whether the interface is in mobile mode */
    isMobile: boolean
    /** Function to toggle sidebar on mobile */
    toggleSidebar: () => void
}

/**
 * Collapsible feed item component for displaying folders with expandable sub-feeds.
 * Supports persistent expand/collapse state and smooth animations.
 */
export function CollapsibleFeedItem({
    feed,
    onAddFeed,
    isMobile,
    toggleSidebar,
}: CollapsibleFeedItemProps) {
    const [isOpen, setIsOpen] = useState(feed.isOpen || false)
    const router = useRouter()
    const pathname = usePathname()

    // Restore collapse state from localStorage
    useEffect(() => {
        const storedState = localStorage.getItem(`folder-${feed.id}-collapsed`)
        if (storedState !== null) {
            setIsOpen(storedState === "true")
        }
    }, [feed.id])

    /**
     * Handle expand/collapse toggle with persistence
     */
    const handleToggle = (open: boolean) => {
        setIsOpen(open)
        localStorage.setItem(`folder-${feed.id}-collapsed`, open.toString())
    }

    /**
     * Handle folder navigation
     */
    const handleFolderClick = () => {
        const folderUrl = `/folders/${feed.id}/articles`
        router.push(folderUrl)
        if (isMobile) {
            toggleSidebar()
        }
    }

    // Determine active state
    const isActive = pathname === `/folders/${feed.id}/articles`

    return (
        <Collapsible open={isOpen} onOpenChange={handleToggle}>
            <SidebarMenuItem>
                <div className="flex items-center w-full group/item">
                    {/* Expand/collapse trigger */}
                    <CollapsibleTrigger asChild>
                        <button
                            type="button"
                            aria-label={
                                isOpen
                                    ? `Collapse folder ${feed.title}`
                                    : `Expand folder ${feed.title}`
                            }
                            className="p-1 mr-1 rounded hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0"
                        >
                            <motion.div
                                animate={{ rotate: isOpen ? 90 : 0 }}
                                transition={{
                                    duration: 0.2,
                                    ease: "easeInOut",
                                }}
                                className="flex items-center justify-center"
                            >
                                <ChevronRight className="h-4 w-4 shrink-0" />
                            </motion.div>
                        </button>
                    </CollapsibleTrigger>

                    {/* Folder navigation button */}
                    <SidebarLeftMenuButton
                        className="justify-start flex-1"
                        isActive={isActive}
                        aria-label={`Navigate to folder ${feed.title}`}
                        onClick={handleFolderClick}
                    >
                        <div className="flex flex-grow items-center overflow-hidden pl-2">
                            {/* Folder icon */}
                            {feed.icon &&
                                React.createElement(feed.icon, {
                                    className: "ml-1 mr-1 h-4 w-4 shrink-0",
                                })}
                            <span className="ml-1 truncate">{feed.title}</span>
                        </div>
                    </SidebarLeftMenuButton>

                    {/* Context menu and count */}
                    <div className="shrink-0 flex items-center pr-2">
                        <FeedDropdownMenu
                            isFolder={true}
                            itemActive={isActive}
                            folderId={feed.id}
                            itemId={feed.id}
                            itemTitle={feed.title}
                            isFavorite={feed.isFavorite}
                            count={feed.count}
                            onAddFeed={onAddFeed}
                        />
                    </div>
                </div>

                {/* Collapsible content with sub-feeds */}
                <CollapsibleContent forceMount className="overflow-hidden">
                    <AnimatePresence>
                        {isOpen &&
                            Array.isArray(feed.items) &&
                            feed.items.length > 0 && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{
                                        duration: 0.2,
                                        ease: "easeInOut",
                                    }}
                                >
                                    <SidebarMenuSub>
                                        {feed.items.map((item, index) => (
                                            <SubFeedItem
                                                key={item.id}
                                                item={item}
                                                index={index}
                                            />
                                        ))}
                                    </SidebarMenuSub>
                                </motion.div>
                            )}
                    </AnimatePresence>
                </CollapsibleContent>
            </SidebarMenuItem>
        </Collapsible>
    )
}

export type { CollapsibleFeedItemData }
