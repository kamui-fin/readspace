"use client"

import { AnimatePresence, motion } from "framer-motion"
import * as React from "react"
import { useState } from "react"

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
    RSS_QUERY_KEYS,
    useCreateFeed,
    useCreateFolder,
    useDeleteFeed,
    useDeleteFolder,
    useFeeds,
    useFolders,
    useMarkFeedAsRead,
    useMarkFolderAsRead,
    useUnreadCounts,
    useUpdateFeed,
    useUpdateFolder,
} from "@/lib/api/hooks/feeds"
import { cn } from "@/lib/utils"
import { useSidebarModals } from "@/stores/sidebar"
import { useQueryClient } from "@tanstack/react-query"
import {
    BookmarkIcon,
    BookOpen,
    CheckCircle2,
    ChevronRight,
    Clock,
    Diamond,
    Inbox,
    MoreHorizontal,
    Pencil,
    Plus,
    Settings2,
    Star,
    Trash2,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "react-hot-toast"

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
    itemActive,
    itemId,
    itemTitle,
    isFavorite,
}: {
    isFolder: boolean
    itemActive?: boolean
    itemId?: string
    itemTitle?: string
    isFavorite?: boolean
}) {
    const { setIsFolderModalOpen, setIsFeedModalOpen } = useSidebarModals()
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [newName, setNewName] = useState("")
    const markFeedAsRead = useMarkFeedAsRead()
    const markFolderAsRead = useMarkFolderAsRead()
    const updateFeed = useUpdateFeed()
    const updateFolder = useUpdateFolder()
    const deleteFolder = useDeleteFolder()
    const deleteFeed = useDeleteFeed()
    const queryClient = useQueryClient()
    const router = useRouter()
    const pathname = usePathname()
    const [isProcessingDelete, setIsProcessingDelete] = useState(false)

    if (!itemId) return null

    // Handle mark all as read with optimistic UI
    const handleMarkAllAsRead = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        // Optimistically update the UI
        if (isFolder) {
            // For folders, update the unread counts immediately
            queryClient.setQueryData(
                [RSS_QUERY_KEYS.UNREAD_COUNTS],
                (oldData: any) => {
                    if (!oldData) return oldData

                    // Find the folder and set its unread count to 0
                    const newUnreadByFolder = oldData.unread_by_folder?.map(
                        (folder: any) =>
                            folder.folder_id === itemId
                                ? { ...folder, unread_count: 0 }
                                : folder
                    )

                    // Recalculate the total count
                    const reducedTotal = oldData.unread_by_folder?.reduce(
                        (acc: number, folder: any) => {
                            if (folder.folder_id === itemId) return acc
                            return acc + folder.unread_count
                        },
                        0
                    )

                    return {
                        ...oldData,
                        unread_by_folder: newUnreadByFolder,
                        total_unread: reducedTotal || 0,
                    }
                }
            )

            // Also update the articles list to mark all items as read
            queryClient.setQueriesData(
                { queryKey: [RSS_QUERY_KEYS.ARTICLES] },
                (oldData: any) => {
                    if (!oldData) return oldData

                    return {
                        ...oldData,
                        items: oldData.items.map((article: any) => {
                            if (article.feed?.folder_id === itemId) {
                                return { ...article, is_read: true }
                            }
                            return article
                        }),
                    }
                }
            )

            // Now perform the actual update
            markFolderAsRead.mutate(itemId, {
                onSuccess: () => {
                    toast.success("All articles marked as read")
                    queryClient.invalidateQueries({
                        queryKey: [RSS_QUERY_KEYS.ARTICLES],
                    })
                    queryClient.invalidateQueries({
                        queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
                    })
                },
            })
        } else {
            // For feeds, update the feed's articles as read immediately
            queryClient.setQueriesData(
                { queryKey: [RSS_QUERY_KEYS.ARTICLES] },
                (oldData: any) => {
                    if (!oldData) return oldData

                    return {
                        ...oldData,
                        items: oldData.items.map((article: any) => {
                            if (article.feed_id === itemId) {
                                return { ...article, is_read: true }
                            }
                            return article
                        }),
                    }
                }
            )

            // Update unread counts
            queryClient.setQueryData([RSS_QUERY_KEYS.FEEDS], (oldData: any) => {
                if (!oldData) return oldData
                return oldData.map((feed: any) =>
                    feed.id === itemId ? { ...feed, unread_count: 0 } : feed
                )
            })

            // Now perform the actual update
            markFeedAsRead.mutate(itemId, {
                onSuccess: () => {
                    toast.success("All articles marked as read")
                    queryClient.invalidateQueries({
                        queryKey: [RSS_QUERY_KEYS.ARTICLES],
                    })
                    queryClient.invalidateQueries({
                        queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
                    })
                },
            })
        }
    }

    // Handle rename
    const handleRename = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
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
                            toast.success("Folder renamed")
                            queryClient.invalidateQueries({
                                queryKey: [RSS_QUERY_KEYS.FOLDERS],
                            })
                        },
                        onError: (error) => {
                            toast.error("Failed to rename folder")
                            console.error("Rename folder error:", error)
                        },
                    }
                )
            } else {
                updateFeed.mutate(
                    { feedId: itemId, data: { title: newName.trim() } },
                    {
                        onSuccess: () => {
                            setIsRenameModalOpen(false)
                            toast.success("Feed renamed")
                            queryClient.invalidateQueries({
                                queryKey: [RSS_QUERY_KEYS.FEEDS],
                            })
                        },
                        onError: (error) => {
                            toast.error("Failed to rename feed")
                            console.error("Rename feed error:", error)
                        },
                    }
                )
            }
        }
    }

    // Handle toggle favorite
    const handleToggleFavorite = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (!isFolder && itemId) {
            updateFeed.mutate(
                { feedId: itemId, data: { is_favorite: !isFavorite } },
                {
                    onSuccess: () => {
                        toast.success(
                            isFavorite
                                ? "Removed from favorites"
                                : "Added to favorites"
                        )
                        queryClient.invalidateQueries({
                            queryKey: [RSS_QUERY_KEYS.FEEDS],
                        })
                    },
                }
            )
        }
    }

    // Handle delete/unfollow
    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDeleteModalOpen(true)
    }

    // Handle delete confirmation
    const handleDeleteConfirm = async () => {
        if (!itemId) return
        setIsProcessingDelete(true)
        const toastId = `delete-${isFolder ? "folder" : "feed"}-${itemId}`

        if (isFolder) {
            toast.loading(`Deleting folder "${itemTitle}"...`, { id: toastId })
            try {
                // Backend now handles cascading deletes for feeds within the folder.
                await deleteFolder.mutateAsync(itemId)
                toast.success(
                    `Folder "${itemTitle}" and its contents deleted successfully.`,
                    { id: toastId }
                )

                setIsDeleteModalOpen(false)
                // Navigate away if the current view was the deleted folder
                if (pathname.startsWith(`/folders/${itemId}`)) {
                    router.push("/articles")
                }
            } catch (error: any) {
                console.error("Error during folder deletion:", error)
                // Check if the error message is the specific one from the backend if it still fails due to some other check
                const errorMessage =
                    error.response?.data?.detail ||
                    error.message ||
                    `Failed to delete folder "${itemTitle}".`
                toast.error(errorMessage, { id: toastId, duration: 6000 })
            }
        } else {
            // Delete individual feed (this logic remains the same)
            toast.loading(`Unfollowing feed "${itemTitle}"...`, { id: toastId })
            try {
                await deleteFeed.mutateAsync(itemId)
                toast.success(`Feed "${itemTitle}" unfollowed.`, {
                    id: toastId,
                })
                setIsDeleteModalOpen(false)
                if (pathname.startsWith(`/feeds/${itemId}`)) {
                    router.push("/articles")
                }
            } catch (error: any) {
                console.error("Error unfollowing feed:", error)
                toast.error(
                    error.response?.data?.detail ||
                        error.message ||
                        `Failed to unfollow feed "${itemTitle}".`,
                    { id: toastId }
                )
            }
        }
        setIsProcessingDelete(false)
    }

    return (
        <>
            <DropdownMenuContent align="start" className="w-[200px]">
                {!isFolder && (
                    <DropdownMenuItem onClick={handleToggleFavorite}>
                        {isFavorite ? (
                            <>
                                <Star className="mr-2 h-4 w-4 fill-current" />
                                <span>Remove favorite</span>
                            </>
                        ) : (
                            <>
                                <Star className="mr-2 h-4 w-4" />
                                <span>Add to favorites</span>
                            </>
                        )}
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleMarkAllAsRead}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    <span>Mark all as read</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleRename}>
                    <Pencil className="mr-2 h-4 w-4" />
                    <span>Rename</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="text-red-600 focus:text-red-600 hover:text-red-600 focus:bg-red-50 dark:focus:text-red-400 dark:hover:text-red-400"
                    onClick={handleDelete}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>{isFolder ? "Delete" : "Unfollow"}</span>
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
                    </DialogHeader>
                    <form onSubmit={handleRenameSubmit}>
                        <Input
                            autoFocus
                            placeholder={isFolder ? "Folder name" : "Feed name"}
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                        />
                        <DialogFooter className="mt-4 flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsRenameModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    isFolder
                                        ? updateFolder.status === "pending"
                                        : updateFeed.status === "pending"
                                }
                                className="bg-primary"
                            >
                                {isFolder
                                    ? updateFolder.status === "pending"
                                        ? "Renaming..."
                                        : "Rename"
                                    : updateFeed.status === "pending"
                                      ? "Renaming..."
                                      : "Rename"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete/Unfollow Modal */}
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
                            {isFolder
                                ? `Are you sure you want to delete the folder "${itemTitle}"? All feeds and articles within this folder will also be deleted.`
                                : `Are you sure you want to unfollow "${itemTitle}"?`}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4 flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsDeleteModalOpen(false)}
                            disabled={isProcessingDelete}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDeleteConfirm}
                            disabled={
                                isProcessingDelete ||
                                (isFolder
                                    ? deleteFolder.status === "pending"
                                    : deleteFeed.status === "pending")
                            }
                        >
                            {isProcessingDelete
                                ? "Processing..."
                                : isFolder
                                  ? deleteFolder.status === "pending"
                                      ? "Deleting..."
                                      : "Delete"
                                  : deleteFeed.status === "pending"
                                    ? "Unfollowing..."
                                    : "Unfollow"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
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
}: {
    isFolder: boolean
    itemActive?: boolean
    folderId?: string
    itemId?: string
    itemTitle?: string
    isFavorite?: boolean
    isAll?: boolean
}) {
    const { setSelectedFolderId, setIsFeedModalOpen } = useSidebarModals()

    // Don't show context menu for "All" item
    if (isAll) {
        return null
    }

    return (
        <>
            {isFolder && (
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
                        setSelectedFolderId(folderId || null)
                        setIsFeedModalOpen(true)
                    }}
                    title="Add new feed"
                >
                    <Plus className="h-4 w-4" />
                    <span className="sr-only">Add</span>
                </Button>
            )}

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "h-6 w-6 p-0 transition-all duration-200",
                            "opacity-0 group-hover/item:opacity-100 focus:opacity-100",
                            "hover:bg-muted hover:text-primary",
                            "active:scale-95",
                            "rounded-full cursor-pointer data-[state=open]:opacity-100 data-[state=open]:bg-muted focus-visible:opacity-100"
                        )}
                        title="More options"
                        onBlur={(e) => {
                            // Only blur if not related target is within dropdown
                            if (
                                !e.currentTarget.contains(
                                    e.relatedTarget as Node
                                )
                            ) {
                                e.currentTarget.blur()
                            }
                        }}
                    >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">More</span>
                    </Button>
                </DropdownMenuTrigger>

                <FeedContextMenu
                    isFolder={isFolder}
                    itemActive={itemActive}
                    itemId={itemId}
                    itemTitle={itemTitle}
                    isFavorite={isFavorite}
                />
            </DropdownMenu>
        </>
    )
}

// Sub Feed Item component
function SubFeedItem({ item, index }: { item: SubFeedItem; index: number }) {
    const [imageError, setImageError] = useState(false)

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15, delay: index * 0.03 }}
        >
            <SidebarMenuSubItem key={item.title}>
                <SidebarLeftMenuSubButton
                    asChild
                    isActive={item.isActive}
                    className="py-0 group/item"
                >
                    <Link href={item.url} className="flex w-full items-center">
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
                        <div className="ml-auto flex shrink-0 items-center">
                            <FeedDropdownMenu
                                isFolder={false}
                                itemActive={item.isActive}
                                itemId={item.id}
                                itemTitle={item.title}
                                isFavorite={item.isFavorite}
                            />
                            {item.count && (
                                <span className="ml-1.5 mr-2 text-xs text-muted-foreground">
                                    {item.count}
                                </span>
                            )}
                        </div>
                    </Link>
                </SidebarLeftMenuSubButton>
            </SidebarMenuSubItem>
        </motion.div>
    )
}

// Collapsible Feed Item component
function CollapsibleFeedItem({ feed }: { feed: FeedItem }) {
    const [isOpen, setIsOpen] = React.useState(feed.isOpen || false)
    const router = useRouter()
    const pathname = usePathname()

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

    return (
        <Collapsible key={feed.title} open={isOpen} onOpenChange={handleToggle}>
            <SidebarMenuItem>
                <SidebarLeftMenuButton
                    className={`group/item justify-start ${isActivePath ? "bg-muted" : ""}`}
                    aria-label={`Navigate to folder ${feed.title}`}
                    onClick={() => router.push(`/folders/${feed.id}/articles`)}
                >
                    <div className="flex flex-grow items-center overflow-hidden pl-2">
                        <CollapsibleTrigger asChild>
                            <button
                                type="button"
                                aria-label={
                                    isOpen
                                        ? `Collapse folder ${feed.title}`
                                        : `Expand folder ${feed.title}`
                                }
                                onClick={(e) => {
                                    e.stopPropagation() // Prevent navigation onClick from parent
                                    // CollapsibleTrigger handles calling onOpenChange which calls handleToggle
                                }}
                                className="p-1 mr-1 rounded hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                <motion.div
                                    animate={{ rotate: isOpen ? 90 : 0 }}
                                    transition={{
                                        duration: 0.2,
                                        ease: "easeInOut",
                                    }}
                                    className="flex items-center justify-center" // For better alignment if padding is uneven
                                >
                                    <ChevronRight className="h-4 w-4 shrink-0" />
                                </motion.div>
                            </button>
                        </CollapsibleTrigger>

                        {feed.icon &&
                            React.createElement(feed.icon, {
                                className: "ml-1 mr-1 h-4 w-4 shrink-0",
                            })}
                        <span className="ml-1 truncate">{feed.title}</span>
                    </div>
                    <div className="ml-auto flex shrink-0 items-center pr-2">
                        <FeedDropdownMenu
                            isFolder={true}
                            itemActive={isActivePath}
                            folderId={feed.id}
                            itemId={feed.id}
                            itemTitle={feed.title}
                            isFavorite={feed.isFavorite}
                        />
                        {feed.count && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                                {feed.count}
                            </span>
                        )}
                    </div>
                </SidebarLeftMenuButton>
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

    return (
        <SidebarMenuItem key={feed.title}>
            <SidebarLeftMenuButton asChild className="justify-start group/item">
                <Link href={feed.url}>
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
                    <div className="ml-auto flex shrink-0 items-center pr-2">
                        <FeedDropdownMenu
                            isFolder={false}
                            itemActive={feed.isActive}
                            itemId={feed.id}
                            itemTitle={feed.title}
                            isFavorite={feed.isFavorite}
                            isAll={isAll}
                        />
                        {feed.count !== null && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                                {feed.count}
                            </span>
                        )}
                    </div>
                </Link>
            </SidebarLeftMenuButton>
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

    return (
        <SidebarGroup>
            <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                            asChild
                            tooltip={item.title}
                            isMobile={isMobile}
                            toggleSidebar={toggleSidebar}
                            isActive={pathname === item.url}
                        >
                            <Link href={item.url}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    )
}

// Feeds Navigation component
export function FeedsNavigation() {
    const { data: folders = [], isLoading: isFoldersLoading } = useFolders()
    const { data: feeds = [], isLoading: isFeedsLoading } = useFeeds()
    const { data: unreadCounts, isLoading: isUnreadCountsLoading } =
        useUnreadCounts()
    const pathname = usePathname()
    const router = useRouter()
    const createFolder = useCreateFolder()
    const createFeed = useCreateFeed()
    const {
        isFolderModalOpen,
        setIsFolderModalOpen,
        isFeedModalOpen,
        setIsFeedModalOpen,
        selectedFolderId,
        setSelectedFolderId,
    } = useSidebarModals()
    const [folderName, setFolderName] = useState("")
    const [feedUrl, setFeedUrl] = useState("")
    const queryClient = useQueryClient()

    // Group feeds by folder
    const feedsByFolder = React.useMemo(() => {
        const result: Record<string, typeof feeds> = {}

        // Initialize with empty arrays for each folder
        folders.forEach((folder) => {
            result[folder.id] = []
        })

        // Add "No Folder" category
        result["no_folder"] = []

        // Populate feeds into their folders
        feeds.forEach((feed) => {
            if (feed.folder_id) {
                if (result[feed.folder_id]) {
                    result[feed.folder_id].push(feed)
                }
            } else {
                result["no_folder"].push(feed)
            }
        })

        return result
    }, [folders, feeds])

    // Transform data for rendering
    const feedItems: FeedItem[] = React.useMemo(() => {
        const items: FeedItem[] = []

        // Extract feed id from pathname if we're viewing a feed
        const feedIdFromPath = pathname.match(
            /\/feeds\/([^\/]+)\/articles/
        )?.[1]
        // Find the parent folder of the current feed if we're viewing a feed
        const currentFeedParentFolder = feedIdFromPath
            ? feeds.find((feed) => feed.id === feedIdFromPath)?.folder_id
            : null

        // Add "All" item
        items.push({
            id: "all",
            title: "All",
            url: "/articles",
            count: unreadCounts?.total_unread || 0,
            icon: Inbox,
            isActive: pathname === "/articles",
            isFavorite: false,
        })

        // Add folder items
        folders.forEach((folder) => {
            const folderFeeds = feedsByFolder[folder.id] || []
            const folderUnreadCount =
                unreadCounts?.unread_by_folder?.find(
                    (item) => item.folder_id === folder.id
                )?.unread_count || null

            // Determine if this folder should be open
            // It should be open if we're either viewing the folder itself, or viewing a feed that belongs to this folder
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
                isOpen: shouldBeOpen, // Set to true if we're viewing this folder or a feed within it
                isActive: pathname === `/folders/${folder.id}/articles`,
                isFavorite: false,
                items: folderFeeds.map((feed) => ({
                    id: feed.id,
                    title: feed.title,
                    url: `/feeds/${feed.id}/articles`,
                    count: feed.unread_count,
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
                count: feed.unread_count,
                icon: null,
                isActive: pathname === `/feeds/${feed.id}/articles`,
                isFavorite: feed.is_favorite || false,
            })
        })

        return items
    }, [folders, feeds, feedsByFolder, unreadCounts, pathname])

    const handleAddFolder = () => {
        setIsFolderModalOpen(true)
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
        if (feedUrl.trim() && selectedFolderId) {
            createFeed.mutate(
                { url: feedUrl.trim(), folder_id: selectedFolderId },
                {
                    onSuccess: () => {
                        setIsFeedModalOpen(false)
                        setFeedUrl("")
                        setSelectedFolderId(null)
                    },
                }
            )
        }
    }

    if (isFoldersLoading || isFeedsLoading || isUnreadCountsLoading) {
        return (
            <SidebarGroup className="mt-2">
                <SidebarGroupLabel>Feeds</SidebarGroupLabel>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <div className="py-4 text-center text-muted-foreground text-sm">
                            Loading feeds...
                        </div>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroup>
        )
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
                {feedItems.map((feed) =>
                    feed.isCollapsible ? (
                        <CollapsibleFeedItem key={feed.id} feed={feed} />
                    ) : (
                        <RegularFeedItem key={feed.id} feed={feed} />
                    )
                )}
            </SidebarMenu>

            {/* Modal for adding folder */}
            <Dialog
                open={isFolderModalOpen}
                onOpenChange={setIsFolderModalOpen}
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
                                    ? "Adding..."
                                    : "Add"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal for adding feed */}
            <Dialog open={isFeedModalOpen} onOpenChange={setIsFeedModalOpen}>
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
                                {createFeed.status === "pending"
                                    ? "Adding..."
                                    : "Add"}
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
            <FeedsNavigation />
            <LibraryNavigation />
        </>
    )
}
