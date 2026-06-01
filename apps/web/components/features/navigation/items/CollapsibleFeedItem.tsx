import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
    SidebarMenuItem,
    SidebarMenuSub,
} from "@/components/ui/sidebar"
import { ChevronRight } from "lucide-react"
import { SubFeedItem, type SubFeedItemData } from "./SubFeedItem"
import { FeedDropdownMenu } from "../menus/FeedContextMenu"
import { usePersistentState } from "@/hooks/use-persistent-state"
import { cn } from "@/lib/utils"

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
    const [isOpen, setIsOpen] = usePersistentState(
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
    isActive: boolean
}

function FeedItemRoot({ children, isActive }: FeedItemRootProps) {
    return (
        <SidebarMenuItem>
            <div className={cn(
                "relative flex items-center w-full group/item h-8 rounded-md text-sm transition-colors duration-150 px-1",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            )}>
                {children}
            </div>
        </SidebarMenuItem>
    )
}

interface FeedItemToggleProps {
    isOpen: boolean
    title: string
}

function FeedItemToggle({ isOpen, title }: FeedItemToggleProps) {
    return (
        <CollapsibleTrigger asChild>
            <button
                type="button"
                aria-label={
                    isOpen
                        ? `Collapse folder ${title}`
                        : `Expand folder ${title}`
                }
                className="p-1 mr-1 rounded-sm hover:bg-muted-foreground/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0 text-muted-foreground transition-colors"
            >
                <motion.div
                    animate={{ rotate: isOpen ? 90 : 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="flex items-center justify-center"
                >
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                </motion.div>
            </button>
        </CollapsibleTrigger>
    )
}

interface FeedItemButtonProps {
    onClick: () => void
    title: string
    children: React.ReactNode
}

function FeedItemButton({
    onClick,
    title,
    children,
}: FeedItemButtonProps) {
    return (
        <button
            type="button"
            aria-label={`Navigate to folder ${title}`}
            onClick={onClick}
            className="flex flex-1 items-center overflow-hidden h-full text-left pr-10 pl-1 outline-none select-none cursor-pointer"
        >
            <div className="flex flex-grow items-center overflow-hidden">
                {children}
            </div>
        </button>
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
            <FeedItemRoot isActive={isActive}>
                <FeedItemToggle isOpen={isOpen} title={feed.title} />
                <FeedItemButton
                    onClick={handleNavigate}
                    title={feed.title}
                >
                    {feed.icon &&
                        React.createElement(feed.icon, {
                            className: "ml-1 mr-1 h-4 w-4 shrink-0",
                        })}
                    <span className="ml-1 truncate">{feed.title}</span>
                </FeedItemButton>

                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center pointer-events-auto">
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
