"use client"

import { AnimatePresence, motion } from "framer-motion"
import * as React from "react"

import {
    BookmarkIcon,
    Check,
    ChevronRight,
    Clock,
    Diamond,
    Inbox,
    MoreHorizontal,
    Move,
    Pencil,
    Plus,
    Rss,
    Share,
    Star,
    Trash2,
    Users
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarLeftMenuButton,
    SidebarLeftMenuSubButton,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubItem,
    useSidebarLeft
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

// Types
type MainNavItem = {
    title: string
    icon: React.ElementType
    url: string
}

type SubFeedItem = {
    title: string
    url: string
    count: number | null
    image?: string
    isActive: boolean
}

type FeedItem = {
    title: string
    url: string
    count: number | null
    icon: React.ElementType | null
    isActive: boolean
    isCollapsible?: boolean
    isOpen?: boolean
    items?: SubFeedItem[]
}

// Menu Trigger Button component
function MenuTriggerButton() {
    return (
        <Button
            variant="ghost"
            size="sm"
            className={cn(
                "h-6 w-6 p-0 transition-opacity",
                "opacity-0 group-hover/item:opacity-100 data-[state=open]:opacity-100",
                "pointer-events-auto"
            )}
            onClick={(e) => e.preventDefault()}
        >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">More</span>
        </Button>
    )
}

// Feed Context Menu component
function FeedContextMenu({ isFolder, itemActive }: { isFolder: boolean, itemActive?: boolean }) {
    return (
        <DropdownMenuContent className="w-52" side="right" align="start">
            <DropdownMenuItem>
                <Check className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Mark all as read</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
                <Pencil className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Rename</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
                <Star className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Add to Favorites</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
                <Move className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Move to...</span>
            </DropdownMenuItem>
            {isFolder ? (
                <DropdownMenuItem>
                    <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>See Similar Feeds</span>
                </DropdownMenuItem>
            ) : (
                <DropdownMenuItem>
                    <Share className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>Share</span>
                </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600 hover:text-red-600 focus:bg-red-50 dark:focus:text-red-400 dark:hover:text-red-400">
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Unfollow</span>
            </DropdownMenuItem>
        </DropdownMenuContent>
    )
}

// Feed Dropdown Menu component
function FeedDropdownMenu({ isFolder, itemActive }: { isFolder: boolean, itemActive?: boolean }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div className="flex items-center">
                    {isFolder && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-6 w-6 p-0 mr-0.5 transition-all duration-200",
                                "opacity-0 group-hover/item:opacity-100",
                                "hover:bg-primary/10 hover:text-primary",
                                "active:scale-95 active:bg-primary/15",
                                "rounded-full cursor-pointer"
                            )}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // Add feed to folder functionality would go here
                                console.log("Add feed to folder");
                            }}
                            title="Add new feed"
                        >
                            <Plus className="h-4 w-4" />
                            <span className="sr-only">Add</span>
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "h-6 w-6 p-0 transition-opacity",
                            "opacity-0 group-hover/item:opacity-100 data-[state=open]:opacity-100"
                        )}
                    >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">More</span>
                    </Button>
                </div>
            </DropdownMenuTrigger>
            <FeedContextMenu isFolder={isFolder} itemActive={itemActive} />
        </DropdownMenu>
    )
}

// Sub Feed Item component
function SubFeedItem({ item, index }: { item: SubFeedItem; index: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15, delay: index * 0.03 }}
        >
            <SidebarMenuSubItem key={item.title}>
                <SidebarLeftMenuSubButton asChild isActive={item.isActive} className="py-0 group/item">
                    <a href={item.url} className="flex w-full items-center">
                        <div className="flex flex-grow items-center overflow-hidden pl-2">
                            {item.image ? (
                                <img src={item.image} alt="" className="mr-2 h-4 w-4 shrink-0 rounded" />
                            ) : (
                                <div className="mr-2 h-4 w-4 shrink-0 rounded bg-primary/8" />
                            )}
                            <span className="truncate">{item.title}</span>
                        </div>
                        <div className="ml-auto flex shrink-0 items-center">
                            <FeedDropdownMenu isFolder={false} itemActive={item.isActive} />
                            {item.count && (
                                <span className="ml-1.5 mr-2 text-xs text-muted-foreground">{item.count}</span>
                            )}
                        </div>
                    </a>
                </SidebarLeftMenuSubButton>
            </SidebarMenuSubItem>
        </motion.div>
    )
}

// Collapsible Feed Item component
function CollapsibleFeedItem({ feed }: { feed: FeedItem }) {
    const [isOpen, setIsOpen] = React.useState(feed.isOpen || false);

    return (
        <Collapsible
            key={feed.title}
            defaultOpen={feed.isOpen}
            open={isOpen}
            onOpenChange={setIsOpen}
        >
            <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarLeftMenuButton className="group/trigger justify-start group/item">
                        <div className="flex flex-grow items-center overflow-hidden pl-2">
                            <motion.div
                                animate={{ rotate: isOpen ? 90 : 0 }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                className="mr-1"
                            >
                                <ChevronRight className="h-4 w-4 shrink-0" />
                            </motion.div>
                            {feed.icon && React.createElement(feed.icon, { className: "ml-1 mr-1 h-4 w-4 shrink-0" })}
                            <span className="ml-1 truncate">{feed.title}</span>
                        </div>
                        <div className="ml-auto flex shrink-0 items-center pr-2">
                            <FeedDropdownMenu isFolder={true} itemActive={feed.isActive} />
                            {feed.count && <span className="ml-1.5 text-xs text-muted-foreground">{feed.count}</span>}
                        </div>
                    </SidebarLeftMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent forceMount className="overflow-hidden">
                    <AnimatePresence>
                        {isOpen && Array.isArray(feed.items) && feed.items.length > 0 && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                            >
                                <SidebarMenuSub>
                                    {feed.items.map((item, index) => (
                                        <SubFeedItem key={item.title} item={item} index={index} />
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

// Regular Feed Item component
function RegularFeedItem({ feed }: { feed: FeedItem }) {
    return (
        <SidebarMenuItem key={feed.title}>
            <SidebarLeftMenuButton className="justify-start group/item">
                <div className="flex flex-grow items-center overflow-hidden pl-2">
                    {feed.icon && React.createElement(feed.icon, { className: "h-4 w-4 mr-1 shrink-0" })}
                    {!feed.icon && <div className="w-4 mr-1 shrink-0"></div>}
                    <span className="ml-1 truncate">{feed.title}</span>
                </div>
                <div className="ml-auto flex shrink-0 items-center pr-2">
                    <FeedDropdownMenu isFolder={false} itemActive={feed.isActive} />
                    {feed.count && <span className="ml-1.5 text-xs text-muted-foreground">{feed.count}</span>}
                </div>
            </SidebarLeftMenuButton>
        </SidebarMenuItem>
    )
}

// Main Navigation Items component
function MainNavigationItems({ items, isMobile, toggleSidebar }: {
    items: MainNavItem[],
    isMobile: boolean,
    toggleSidebar: () => void
}) {
    return (
        <SidebarGroup>
            <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild tooltip={item.title} isMobile={isMobile} toggleSidebar={toggleSidebar}>
                            <a href={item.url}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    )
}

// Feeds Navigation component
function FeedsNavigation({ feeds }: { feeds: FeedItem[] }) {
    return (
        <SidebarGroup className="mt-2">
            <SidebarGroupLabel>Feeds</SidebarGroupLabel>
            <SidebarMenu>
                {feeds.map((feed) =>
                    feed.isCollapsible ? (
                        <CollapsibleFeedItem key={feed.title} feed={feed} />
                    ) : (
                        <RegularFeedItem key={feed.title} feed={feed} />
                    )
                )}
            </SidebarMenu>
        </SidebarGroup>
    )
}

// Main Navigation component
export function NavMain() {
    const { isMobile, toggleSidebar } = useSidebarLeft()

    const mainNavItems: MainNavItem[] = [
        { title: "Today", icon: Diamond, url: "#" },
        { title: "Discover", icon: Rss, url: "#" },
        { title: "Read Later", icon: BookmarkIcon, url: "#" },
        { title: "Recently Read", icon: Clock, url: "#" },
    ]

    const feeds: FeedItem[] = [
        {
            title: "All",
            url: "#",
            count: 289,
            icon: Inbox,
            isActive: false,
        },
        {
            title: "philosophy",
            url: "#",
            count: null,
            icon: null,
            isCollapsible: true,
            isOpen: false,
            items: [],
            isActive: false,
        },
        {
            title: "programming",
            url: "#",
            count: 289,
            icon: null,
            isCollapsible: true,
            isOpen: true,
            isActive: false,
            items: [
                { title: "Martin Fowler", url: "#", count: 1, isActive: false },
                { title: "Slashdot", url: "#", count: 136, isActive: false },
                { title: "TechCrunch", url: "#", count: 149, isActive: true },
                { title: "This Week in Rust", url: "#", count: 3, isActive: false },
            ],
        },
    ]

    return (
        <>
            <MainNavigationItems items={mainNavItems} isMobile={isMobile} toggleSidebar={toggleSidebar} />
            <FeedsNavigation feeds={feeds} />
        </>
    )
}