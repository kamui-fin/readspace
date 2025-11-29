"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
    SidebarLeftMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
} from "@/components/ui/sidebar"
import { ChevronRight } from "lucide-react"
import { SubFeedItem, type SubFeedItemData } from "./SubFeedItem"
import { FeedDropdownMenu } from "../menus/FeedContextMenu"
import { usePersistedState } from "@/hooks/use-persisted-state"

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

// Custom hooks
function useFeedCollapse(feedId: string, initialOpen?: boolean) {
    const [isOpen, setIsOpen] = usePersistedState(
        `folder-${feedId}-collapsed`,
        initialOpen || false
    )

    return { isOpen, toggle: setIsOpen }
}

function useFeedNavigation(
    feedId: string,
    isMobile: boolean,
    toggleSidebar: () => void
) {
    const router = useRouter()

    const handleNavigate = React.useCallback(() => {
        router.push(`/folders/${feedId}/articles`)
        if (isMobile) toggleSidebar()
    }, [feedId, isMobile, router, toggleSidebar])

    return { handleNavigate }
}

// Sub-components
interface FeedItemRootProps {
    children: React.ReactNode
}

function FeedItemRoot({ children }: FeedItemRootProps) {
    return (
        <SidebarMenuItem>
            <div className="flex items-center w-full group/item">
                {children}
            </div>
        </SidebarMenuItem>
    )
}

interface FeedItemToggleProps {
    isOpen: boolean
    onToggle: (open: boolean) => void
    title: string
}

function FeedItemToggle({ isOpen, onToggle, title }: FeedItemToggleProps) {
    return (
        <CollapsibleTrigger asChild>
            <button
                type="button"
                aria-label={
                    isOpen
                        ? `Collapse folder ${title}`
                        : `Expand folder ${title}`
                }
                className="p-1 mr-1 rounded hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0"
            >
                <motion.div
                    animate={{ rotate: isOpen ? 90 : 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="flex items-center justify-center"
                >
                    <ChevronRight className="h-4 w-4 shrink-0" />
                </motion.div>
            </button>
        </CollapsibleTrigger>
    )
}

interface FeedItemButtonProps {
    onClick: () => void
    isActive: boolean
    title: string
    children: React.ReactNode
}

function FeedItemButton({
    onClick,
    isActive,
    title,
    children,
}: FeedItemButtonProps) {
    return (
        <SidebarLeftMenuButton
            className="justify-start flex-1"
            isActive={isActive}
            aria-label={`Navigate to folder ${title}`}
            onClick={onClick}
        >
            <div className="flex flex-grow items-center overflow-hidden pl-2">
                {children}
            </div>
        </SidebarLeftMenuButton>
    )
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
    const { isOpen, toggle } = useFeedCollapse(feed.id, feed.isOpen)
    const { handleNavigate } = useFeedNavigation(
        feed.id,
        isMobile,
        toggleSidebar
    )
    const pathname = usePathname()
    const isActive = pathname === `/folders/${feed.id}/articles`

    return (
        <Collapsible open={isOpen} onOpenChange={toggle}>
            <FeedItemRoot>
                <FeedItemToggle
                    isOpen={isOpen}
                    onToggle={toggle}
                    title={feed.title}
                />
                <FeedItemButton
                    onClick={handleNavigate}
                    isActive={isActive}
                    title={feed.title}
                >
                    {feed.icon &&
                        React.createElement(feed.icon, {
                            className: "ml-1 mr-1 h-4 w-4 shrink-0",
                        })}
                    <span className="ml-1 truncate">{feed.title}</span>
                </FeedItemButton>

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
            </FeedItemRoot>

            <div
                className="overflow-hidden"
                style={{
                    maxHeight: isOpen ? "none" : "0",
                    visibility: isOpen ? "visible" : "hidden",
                }}
            >
                {Array.isArray(feed.items) && feed.items.length > 0 && (
                    <SidebarMenuSub>
                        {feed.items.map((item) => (
                            <SubFeedItem
                                key={item.id}
                                item={item}
                                index={0}
                                disableAnimation={true}
                            />
                        ))}
                    </SidebarMenuSub>
                )}
            </div>
        </Collapsible>
    )
}

export type { CollapsibleFeedItemData }
