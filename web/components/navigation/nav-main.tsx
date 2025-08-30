"use client"

import { AnimatePresence, motion } from "framer-motion"
import * as React from "react"
import { useState } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
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
    useSidebarLeft,
} from "@/components/ui/sidebar"
import {
    useCreateFeed,
    useCreateFolder,
    useDeleteFeed,
    useDeleteFolder,
    useFeeds,
    useFolders,
    useUnreadCounts,
    useUpdateFeed,
    useUpdateFolder,
} from "@/lib/api/hooks/feeds"
import { cn } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import {
    BookmarkIcon,
    BookOpen,
    ChevronRight,
    Clock,
    Diamond,
    Inbox,
    Loader2,
    MoreHorizontal,
    Pencil,
    Plus,
    Settings2,
    Trash2,
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import {
    SidebarFeedsSkeleton,
    SidebarLibrarySkeleton,
} from "./sidebar-skeleton"
import { useNavigationState, useOptimisticNavigation } from "@/hooks/use-navigation-state"

// Types
type MainNavItem = {
    title: string
    icon: React.ElementType
    url: string
}

type SubFeedItem = {
    id: string
    title: string
    url: string
    count: number | null
    image?: string
    isActive: boolean
    isFavorite: boolean
}

type FeedItem = {
    id: string
    title: string
    url: string
    count: number | null
    icon: React.ElementType | null
    isActive: boolean
    isCollapsible?: boolean
    isOpen?: boolean
    isFavorite: boolean
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
function FeedContextMenu({
    isFolder,
    itemId,
    itemTitle,
}: {
    isFolder: boolean
    itemActive?: boolean
    itemId?: string
    itemTitle?: string
    isFavorite?: boolean
}) {
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [newName, setNewName] = useState("")
    const updateFeed = useUpdateFeed()
    const updateFolder = useUpdateFolder()
    const deleteFeed = useDeleteFeed()
    const deleteFolder = useDeleteFolder()
    const router = useRouter()
    const pathname = usePathname()
    const [isProcessingDelete, setIsProcessingDelete] = useState(false)

    if (!itemId) return null

    // Handle rename
    const handleRename = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDropdownOpen(false) // Close dropdown first
        if (itemTitle) {
            setNewName(itemTitle)
            setIsRenameModalOpen(true)
        }
    }

    // Handle rename submit
    const handleRenameSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (newName.trim() && itemId) {
            if (isFolder) {
                updateFolder.mutate(
                    { folderId: itemId, name: newName.trim() },
                    {
                        onSuccess: () => {
                            setIsRenameModalOpen(false)
                            setNewName("")
                            toast.success("Folder renamed successfully!")
                        },
                    }
                )
            } else {
                updateFeed.mutate(
                    { feedId: itemId, data: { title: newName.trim() } },
                    {
                        onSuccess: () => {
                            setIsRenameModalOpen(false)
                            setNewName("")
                        },
                    }
                )
            }
        }
    }

    // Handle delete
    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDropdownOpen(false) // Close dropdown first
        setIsDeleteModalOpen(true)
    }

    // Handle delete confirm
    const handleDeleteConfirm = async () => {
        if (!itemId) return
        setIsProcessingDelete(true)
        
        // Navigate immediately before deletion to prevent "not found" errors
        if (isFolder && pathname.includes(`/folders/${itemId}`)) {
            router.push("/articles")
        } else if (!isFolder && pathname.includes(itemId)) {
            router.push("/articles")
        }
        
        try {
            if (isFolder) {
                await deleteFolder.mutateAsync(itemId)
            } else {
                await deleteFeed.mutateAsync({ feedId: itemId })
            }
            setIsDeleteModalOpen(false)
        } catch (error: unknown) {
            // Error toast is handled by the mutation
        } finally {
            setIsProcessingDelete(false)
        }
    }

    return (
        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "h-6 w-6 p-0 transition-all duration-200",
                        "opacity-0 group-hover/item:opacity-100 data-[state=open]:opacity-100",
                        "hover:bg-muted hover:text-primary",
                        "active:scale-95",
                        "rounded-full cursor-pointer"
                    )}
                    onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                    }}
                >
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
                <DropdownMenuItem onClick={handleRename}>
                    <Pencil className="mr-2 h-4 w-4" />
                    <span>Rename</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-destructive focus:text-destructive"
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>{isFolder ? "Delete folder" : "Unfollow"}</span>
                </DropdownMenuItem>
            </DropdownMenuContent>

            {/* Rename Modal */}
            <Dialog
                open={isRenameModalOpen}
                onOpenChange={setIsRenameModalOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Rename {isFolder ? "Folder" : "Feed"}
                        </DialogTitle>
                        <DialogDescription>
                            Enter a new name for this{" "}
                            {isFolder ? "folder" : "feed"}.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleRenameSubmit}>
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder={`${isFolder ? "Folder" : "Feed"} name`}
                            className="mb-4"
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsRenameModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!newName.trim()}>
                                Rename
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Modal */}
            <Dialog
                open={isDeleteModalOpen}
                onOpenChange={setIsDeleteModalOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {isFolder ? "Delete Folder" : "Unfollow Feed"}
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to{" "}
                            {isFolder ? "delete" : "unfollow"} "{itemTitle}"?
                            {isFolder &&
                                " This will also delete all feeds in this folder."}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsDeleteModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDeleteConfirm}
                            disabled={isProcessingDelete}
                            variant="destructive"
                        >
                            {isProcessingDelete
                                ? "Processing..."
                                : isFolder
                                  ? "Delete"
                                  : "Unfollow"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DropdownMenu>
    )
}

// Feed Dropdown Menu component
function FeedDropdownMenu({
    isFolder,
    itemActive,
    folderId,
    itemId,
    itemTitle,
    isFavorite,
    isAll,
    count,
    onAddFeed,
}: {
    isFolder: boolean
    itemActive?: boolean
    folderId?: string
    itemId?: string
    itemTitle?: string
    isFavorite?: boolean
    isAll?: boolean
    count?: number | null
    onAddFeed?: (folderId: string) => void
}) {
    // Don't show context menu for "All" item
    if (isAll) {
        return (
            <>
                {count != null && count > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                        {count}
                    </span>
                )}
            </>
        )
    }

    return (
        <>
            {isFolder && onAddFeed && folderId && (
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "h-6 w-6 p-0 mr-0.5 transition-all duration-200",
                        "opacity-0 group-hover/item:opacity-100",
                        "hover:bg-muted hover:text-primary",
                        "active:scale-95",
                        "rounded-full cursor-pointer"
                    )}
                    onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onAddFeed(folderId)
                    }}
                    title="Add new feed"
                >
                    <Plus className="h-4 w-4" />
                    <span className="sr-only">Add</span>
                </Button>
            )}
            <FeedContextMenu
                isFolder={isFolder}
                itemId={itemId}
                itemTitle={itemTitle}
                isFavorite={isFavorite}
            />
            {count != null && count > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">
                    {count}
                </span>
            )}
        </>
    )
}

// Sub Feed Item component
function SubFeedItem({ item, index }: { item: SubFeedItem; index: number }) {
    const [imageError, setImageError] = useState(false)
    const { handleOptimisticClick } = useOptimisticNavigation()
    const { pendingPath } = useNavigationState()
    
    const isOptimisticallyActive = pendingPath === item.url
    const isActiveState = item.isActive || isOptimisticallyActive

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15, delay: index * 0.03 }}
        >
            <SidebarMenuSubItem key={item.title}>
                <div className="flex items-center w-full group/item">
                    <SidebarLeftMenuSubButton
                        asChild
                        isActive={isActiveState}
                        className="py-0 flex-1"
                    >
                        <Link
                            href={item.url}
                            className="flex w-full items-center"
                            onClick={() => handleOptimisticClick(item.url)}
                        >
                            <div className="flex flex-grow items-center overflow-hidden pl-2">
                                {item.image && !imageError ? (
                                    <img
                                        src={item.image}
                                        alt=""
                                        className="mr-2 h-4 w-4 shrink-0 rounded"
                                        onError={() => setImageError(true)}
                                    />
                                ) : (
                                    <div className="mr-2 h-4 w-4 shrink-0 rounded bg-primary/8" />
                                )}
                                <span className="truncate">{item.title}</span>
                            </div>
                        </Link>
                    </SidebarLeftMenuSubButton>
                    <div className="shrink-0 flex items-center pr-2">
                        <FeedDropdownMenu
                            isFolder={false}
                            itemActive={item.isActive}
                            itemId={item.id}
                            itemTitle={item.title}
                            isFavorite={item.isFavorite}
                            count={item.count}
                        />
                    </div>
                </div>
            </SidebarMenuSubItem>
        </motion.div>
    )
}

// Collapsible Feed Item component
function CollapsibleFeedItem({
    feed,
    onAddFeed,
    isMobile,
    toggleSidebar,
}: {
    feed: FeedItem
    onAddFeed: (folderId: string) => void
    isMobile: boolean
    toggleSidebar: () => void
}) {
    const [isOpen, setIsOpen] = React.useState(feed.isOpen || false)
    const router = useRouter()
    const pathname = usePathname()
    const { handleOptimisticClick } = useOptimisticNavigation()
    const { pendingPath } = useNavigationState()

    React.useEffect(() => {
        const storedState = localStorage.getItem(`folder-${feed.id}-collapsed`)
        if (storedState !== null) {
            setIsOpen(storedState === "true")
        }
    }, [feed.id])

    const handleToggle = (open: boolean) => {
        setIsOpen(open)
        localStorage.setItem(`folder-${feed.id}-collapsed`, open.toString())
    }

    const isActivePath = pathname === `/folders/${feed.id}/articles`
    const isOptimisticallyActive = pendingPath === `/folders/${feed.id}/articles`
    const isActiveState = isActivePath || isOptimisticallyActive

    return (
        <Collapsible key={feed.title} open={isOpen} onOpenChange={handleToggle}>
            <SidebarMenuItem>
                <div className="flex items-center w-full group/item">
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
                    <SidebarLeftMenuButton
                        className={`justify-start flex-1`}
                        isActive={isActiveState}
                        aria-label={`Navigate to folder ${feed.title}`}
                        onClick={() => {
                            handleOptimisticClick(`/folders/${feed.id}/articles`)
                            router.push(`/folders/${feed.id}/articles`)
                            if (isMobile) {
                                toggleSidebar()
                            }
                        }}
                    >
                        <div className="flex flex-grow items-center overflow-hidden pl-2">
                            {feed.icon &&
                                React.createElement(feed.icon, {
                                    className: "ml-1 mr-1 h-4 w-4 shrink-0",
                                })}
                            <span className="ml-1 truncate">{feed.title}</span>
                        </div>
                    </SidebarLeftMenuButton>
                    <div className="shrink-0 flex items-center pr-2">
                        <FeedDropdownMenu
                            isFolder={true}
                            itemActive={isActivePath}
                            folderId={feed.id}
                            itemId={feed.id}
                            itemTitle={feed.title}
                            isFavorite={feed.isFavorite}
                            count={feed.count}
                            onAddFeed={onAddFeed}
                        />
                    </div>
                </div>
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

// Regular Feed Item component
function RegularFeedItem({ feed }: { feed: FeedItem }) {
    const isAll = feed.id === "all"
    const { handleOptimisticClick } = useOptimisticNavigation()
    const { pendingPath } = useNavigationState()
    
    const isOptimisticallyActive = pendingPath === feed.url
    const isActiveState = feed.isActive || isOptimisticallyActive

    return (
        <SidebarMenuItem key={feed.title}>
            <div className="flex items-center w-full group/item">
                <SidebarLeftMenuButton asChild className="justify-start flex-1" isActive={isActiveState}>
                    <Link href={feed.url} onClick={() => handleOptimisticClick(feed.url)}>
                        <div className="flex flex-grow items-center overflow-hidden pl-2">
                            {feed.icon &&
                                React.createElement(feed.icon, {
                                    className: "h-4 w-4 mr-1 shrink-0",
                                })}
                            {!feed.icon && (
                                <div className="w-4 mr-1 shrink-0"></div>
                            )}
                            <span className="ml-1 truncate">{feed.title}</span>
                        </div>
                    </Link>
                </SidebarLeftMenuButton>
                <div className="shrink-0 flex items-center pr-2">
                    <FeedDropdownMenu
                        isFolder={false}
                        itemActive={feed.isActive}
                        itemId={feed.id}
                        itemTitle={feed.title}
                        isFavorite={feed.isFavorite}
                        isAll={isAll}
                        count={feed.count}
                    />
                </div>
            </div>
        </SidebarMenuItem>
    )
}

// Main Navigation Items component
function MainNavigationItems({
    items,
    isMobile,
    toggleSidebar,
}: {
    items: MainNavItem[]
    isMobile: boolean
    toggleSidebar: () => void
}) {
    const pathname = usePathname()
    const { handleOptimisticClick } = useOptimisticNavigation()
    const { pendingPath } = useNavigationState()
    const { data: unreadCounts } = useUnreadCounts(undefined, {
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 0, // Always consider stale so invalidation works immediately
    })

    const typedUnreadCounts = unreadCounts as {
        read_later_count?: number
        today_count?: number
    } || {}

    const getCountForItem = (title: string): number | null => {
        switch (title) {
            case "Today":
                return typedUnreadCounts.today_count || 0
            case "Read Later":
                return typedUnreadCounts.read_later_count || 0
            default:
                return null
        }
    }

    return (
        <SidebarGroup>
            <SidebarMenu>
                {items.map((item) => {
                    const count = getCountForItem(item.title)
                    const isOptimisticallyActive = pendingPath === item.url
                    const isActiveState = pathname === item.url || isOptimisticallyActive
                    
                    return (
                        <SidebarMenuItem key={item.title}>
                            <div className="flex items-center w-full group/item">
                                <SidebarMenuButton
                                    asChild
                                    tooltip={item.title}
                                    isMobile={isMobile}
                                    toggleSidebar={toggleSidebar}
                                    isActive={isActiveState}
                                    className="flex-1"
                                >
                                    <Link href={item.url} onClick={() => handleOptimisticClick(item.url)}>
                                        <item.icon className="h-4 w-4" />
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                                <div className="shrink-0 flex items-center pr-2">
                                    {count != null && count > 0 && (
                                        <span className="ml-1 text-xs text-muted-foreground">
                                            {count}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </SidebarMenuItem>
                    )
                })}
            </SidebarMenu>
        </SidebarGroup>
    )
}

// Feeds Navigation component
export function FeedsNavigation({ isMobile, toggleSidebar }: { isMobile: boolean, toggleSidebar: () => void }) {
    // Use the optimized combined sidebar data hook with proper cache configuration
    const { data: folders, isLoading: isFoldersLoading } = useFolders({
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000, // 5 minutes - matches server prefetch staleTime
    })
    const { data: feeds, isLoading: isFeedsLoading } = useFeeds({}, {
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000, // 5 minutes - matches server prefetch staleTime
    })
    const { data: unreadCounts, isLoading: isUnreadCountsLoading } =
        useUnreadCounts(undefined, {
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000, // 5 minutes - matches server prefetch staleTime
        })

    const isSidebarLoading =
        isFoldersLoading || isFeedsLoading || isUnreadCountsLoading

    const pathname = usePathname()
    const router = useRouter()
    const createFolder = useCreateFolder()
    const createFeed = useCreateFeed()

    // Local modal state management
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false)
    const [isFeedModalOpen, setIsFeedModalOpen] = useState(false)
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
        null
    )
    const [folderName, setFolderName] = useState("")
    const [feedUrl, setFeedUrl] = useState("")
    const [feedError, setFeedError] = useState<string | null>(null)
    const queryClient = useQueryClient()

    // Type assertions for API data
    const typedFolders = (folders as Array<{ id: string; name: string }>) || []
    const typedFeeds =
        (feeds as Array<{
            id: string
            title: string
            folder_id: string | null
            unread_count?: number
            image_url?: string
            is_favorite?: boolean
        }>) || []
    const typedUnreadCounts =
        (unreadCounts as {
            total_unread?: number
            unread_by_folder?: Array<{
                folder_id: string
                unread_count: number
            }>
        }) || {}

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
                if (result[feed.folder_id]) {
                    result[feed.folder_id].push(feed)
                }
            } else {
                result["no_folder"].push(feed)
            }
        })

        return result
    }, [typedFolders, typedFeeds])

    // Transform data for rendering
    const feedItems: FeedItem[] = React.useMemo(() => {
        const items: FeedItem[] = []

        // Extract feed id from pathname if we're viewing a feed
        const feedIdFromPath = pathname.match(
            /\/feeds\/([^\/]+)\/articles/
        )?.[1]
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
            icon: Inbox,
            isActive: pathname === "/articles",
            isFavorite: false,
        })

        // Add folder items
        typedFolders.forEach((folder) => {
            const folderFeeds = feedsByFolder[folder.id] || []
            const folderUnreadCount =
                typedUnreadCounts?.unread_by_folder?.find(
                    (item) => item.folder_id === folder.id
                )?.unread_count || null

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
            })
        })

        // Add "No Folder" feeds
        feedsByFolder["no_folder"].forEach((feed) => {
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

    const handleAddFolder = () => {
        setIsFolderModalOpen(true)
    }

    const handleAddFeed = (folderId: string) => {
        setSelectedFolderId(folderId)
        setFeedError(null)
        setIsFeedModalOpen(true)
    }

    const handleModalSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (folderName.trim()) {
            createFolder.mutate(
                { name: folderName.trim() },
                {
                    onSuccess: () => {
                        setIsFolderModalOpen(false)
                        setFolderName("")
                    },
                }
            )
        }
    }

    // Add Feed Modal
    const handleFeedModalSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setFeedError(null) // Clear any previous errors
        
        if (feedUrl.trim() && selectedFolderId) {
            createFeed.mutate(
                { url: feedUrl.trim(), folder_id: selectedFolderId, silent: true },
                {
                    onSuccess: () => {
                        setIsFeedModalOpen(false)
                        setFeedUrl("")
                        setSelectedFolderId(null)
                        setFeedError(null)
                        toast.success("Feed added successfully!")
                    },
                    onError: (error: any) => {
                        // Debug: log the error structure to understand what we're receiving
                        console.error("Feed creation error:", error)
                        
                        // Extract error message from various possible structures
                        let errorMessage = "Failed to add feed."
                        if (error?.message) {
                            errorMessage = error.message
                        } else if (error?.detail) {
                            errorMessage = error.detail
                        } else if (typeof error === 'string') {
                            errorMessage = error
                        } else if (error?.response?.data?.detail) {
                            errorMessage = error.response.data.detail
                        } else if (error?.response?.data?.message) {
                            errorMessage = error.response.data.message
                        }
                        
                        setFeedError(errorMessage)
                    },
                    onSettled: () => {
                        queryClient.invalidateQueries({ queryKey: ["feeds"] })
                    },
                }
            )
        }
    }

    return (
        <SidebarGroup className="mt-2">
            <div className="flex items-center justify-between pr-2">
                <SidebarGroupLabel>Feeds</SidebarGroupLabel>
                <div>
                    <Link href="/manage-feeds">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Manage Feeds"
                            onClick={() => {
                                if (isMobile) {
                                    toggleSidebar()
                                }
                            }}
                        >
                            <Settings2 className="h-4 w-4" />
                            <span className="sr-only">Settings</span>
                        </Button>
                    </Link>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={handleAddFolder}
                        title="Add new folder"
                    >
                        <Plus className="h-4 w-4" />
                        <span className="sr-only">Add</span>
                    </Button>
                </div>
            </div>
            <SidebarMenu>
                {isSidebarLoading ? (
                    <SidebarFeedsSkeleton />
                ) : (
                    feedItems.map((feed) =>
                        feed.isCollapsible ? (
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

            {/* Modal for adding folder */}
            <Dialog
                open={isFolderModalOpen}
                onOpenChange={(open) => {
                    setIsFolderModalOpen(open)
                    if (!open) {
                        setFolderName("")
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Folder</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleModalSubmit}>
                        <Input
                            autoFocus
                            placeholder="Folder name"
                            value={folderName}
                            onChange={(e) => setFolderName(e.target.value)}
                        />
                        <DialogFooter className="mt-4 flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsFolderModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    createFolder.status === "pending" ||
                                    !folderName.trim()
                                }
                            >
                                {createFolder.status === "pending"
                                    ? "Creating..."
                                    : "Create"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isFeedModalOpen} onOpenChange={(open) => {
                setIsFeedModalOpen(open)
                if (!open) {
                    setFeedError(null) // Clear errors when closing
                    setFeedUrl("")
                    setSelectedFolderId(null)
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Feed</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleFeedModalSubmit}>
                        <Input
                            autoFocus
                            placeholder="Feed URL"
                            value={feedUrl}
                            onChange={(e) => setFeedUrl(e.target.value)}
                        />
                        {feedError && (
                            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                                <p className="text-sm text-red-600">{feedError}</p>
                            </div>
                        )}
                        <DialogFooter className="mt-4 flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsFeedModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    createFeed.status === "pending" ||
                                    !feedUrl.trim()
                                }
                            >
                                {createFeed.status === "pending" ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Adding...
                                    </>
                                ) : (
                                    "Add"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </SidebarGroup>
    )
}

function LibraryNavigation() {
    const pathname = usePathname()
    const [isLoading] = useState(false) // We could add actual loading state if needed

    if (isLoading) {
        return <SidebarLibrarySkeleton />
    }

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Other reading</SidebarGroupLabel>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarLeftMenuButton
                        asChild
                        tooltip="Library"
                        isActive={pathname === "/library"}
                    >
                        <Link href="/library" className="pl-2">
                            <BookOpen className="h-4 w-4" />
                            <span>Books</span>
                        </Link>
                    </SidebarLeftMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarGroup>
    )
}

// Main Navigation component
export function NavMain() {
    const { isMobile, toggleSidebar } = useSidebarLeft()
    const pathname = usePathname()

    const mainNavItems: MainNavItem[] = [
        { title: "Today", icon: Diamond, url: "/today" },
        // { title: "Discover", icon: Rss, url: "/discover" },
        { title: "Read Later", icon: BookmarkIcon, url: "/read-later" },
        { title: "Recently Read", icon: Clock, url: "/recently-read" },
    ]

    return (
        <>
            <MainNavigationItems
                items={mainNavItems}
                isMobile={isMobile}
                toggleSidebar={toggleSidebar}
            />
            <FeedsNavigation isMobile={isMobile} toggleSidebar={toggleSidebar} />
            <LibraryNavigation />
        </>
    )
}
