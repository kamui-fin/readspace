"use client"

import { Button } from "@/components/ui/button"
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
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
    cn,
    useDeleteFeed,
    useDeleteFolder,
    useRefreshFeed,
    useUpdateFeed,
    useUpdateFolder,
} from "@readspace/shared"
import { MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "react-hot-toast"

interface FeedContextMenuProps {
    /** Whether this is a folder or feed item */
    isFolder: boolean
    /** Whether the item is currently active */
    itemActive?: boolean
    /** The ID of the item */
    itemId?: string
    /** The title/name of the item */
    itemTitle?: string
    /** Whether the item is favorited */
    isFavorite?: boolean
}

/**
 * Context menu component for feed and folder operations.
 * Provides rename and delete functionality with confirmation dialogs.
 */
export function FeedContextMenu({
    isFolder,
    itemId,
    itemTitle,
}: FeedContextMenuProps) {
    // Modal states
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [newName, setNewName] = useState("")
    const [isProcessingDelete, setIsProcessingDelete] = useState(false)

    // Hooks
    const updateFeed = useUpdateFeed()
    const updateFolder = useUpdateFolder()
    const deleteFeed = useDeleteFeed()
    const deleteFolder = useDeleteFolder()
    const refreshFeed = useRefreshFeed()
    const router = useRouter()
    const pathname = usePathname()

    // Don't render if no item ID provided
    if (!itemId) return null

    /**
     * Handle rename button click
     */
    const handleRename = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDropdownOpen(false)
        if (itemTitle) {
            setNewName(itemTitle)
            setIsRenameModalOpen(true)
        }
    }

    /**
     * Handle rename form submission
     */
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
                            toast.success("Feed renamed successfully!")
                        },
                    }
                )
            }
        }
    }

    /**
     * Handle delete button click
     */
    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDropdownOpen(false)
        setIsDeleteModalOpen(true)
    }

    /**
     * Handle force refresh feed
     */
    const handleRefresh = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDropdownOpen(false)
        if (itemId) {
            refreshFeed.mutate(
                { feedId: itemId, forceRefetch: true },
                {
                    onSuccess: () => {
                        toast.success("Feed refresh initiated!")
                    },
                    onError: () => {
                        toast.error("Failed to refresh feed")
                    },
                }
            )
        }
    }

    /**
     * Handle delete confirmation
     */
    const handleDeleteConfirm = async () => {
        if (!itemId) return
        setIsProcessingDelete(true)

        // Navigate away if currently viewing the item being deleted
        if (isFolder && pathname.includes(`/folders/${itemId}`)) {
            router.push("/today")
        } else if (!isFolder && pathname.includes(itemId)) {
            router.push("/today")
        }

        try {
            if (isFolder) {
                await deleteFolder.mutateAsync(itemId)
                toast.success("Folder deleted successfully!")
            } else {
                await deleteFeed.mutateAsync({ feedId: itemId })
                toast.success("Feed unfollowed successfully!")
            }
            setIsDeleteModalOpen(false)
        } catch (error: unknown) {
            // Error toast is handled by the mutation
            console.error("Failed to delete item:", error)
        } finally {
            setIsProcessingDelete(false)
        }
    }

    return (
        <>
            <DropdownMenu
                open={isDropdownOpen}
                onOpenChange={setIsDropdownOpen}
            >
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "h-6 w-6 p-0 transition-all duration-150",
                            "opacity-0 group-hover/item:opacity-100 data-[state=open]:opacity-100",
                            "hover:bg-[hsl(var(--nav-hover))]",
                            "active:bg-[hsl(var(--nav-hover))/0.8]",
                            "rounded-full cursor-pointer"
                        )}
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                        }}
                        aria-label={`More options for ${itemTitle}`}
                    >
                        <MoreHorizontal className="h-4 w-4 transition-colors duration-150" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[200px]">
                    <DropdownMenuItem onClick={handleRename}>
                        <Pencil className="mr-2 h-4 w-4" />
                        <span>Rename</span>
                    </DropdownMenuItem>
                    {/* Only show refresh option for feeds, not folders */}
                    {!isFolder && (
                        <DropdownMenuItem
                            onClick={handleRefresh}
                            disabled={refreshFeed.status === "pending"}
                        >
                            <RefreshCw className={`mr-2 h-4 w-4 ${refreshFeed.status === "pending" ? "animate-spin" : ""}`} />
                            <span>Force check new articles</span>
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                        onClick={handleDelete}
                        className="text-destructive focus:text-destructive"
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>{isFolder ? "Delete folder" : "Unfollow"}</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Rename Modal */}
            <Dialog
                open={isRenameModalOpen}
                onOpenChange={setIsRenameModalOpen}
            >
                <DialogContent className="sm:max-w-[425px]">
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
                        <div className="grid gap-4 py-4">
                            <Input
                                id="rename-input"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder={`${isFolder ? "Folder" : "Feed"} name`}
                                autoFocus
                                disabled={
                                    updateFeed.status === "pending" ||
                                    updateFolder.status === "pending"
                                }
                            />
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsRenameModalOpen(false)}
                                disabled={
                                    updateFeed.status === "pending" ||
                                    updateFolder.status === "pending"
                                }
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    !newName.trim() ||
                                    updateFeed.status === "pending" ||
                                    updateFolder.status === "pending"
                                }
                            >
                                {updateFeed.status === "pending" ||
                                    updateFolder.status === "pending"
                                    ? "Renaming..."
                                    : "Rename"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog
                open={isDeleteModalOpen}
                onOpenChange={setIsDeleteModalOpen}
            >
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>
                            {isFolder ? "Delete Folder" : "Unfollow Feed"}
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to{" "}
                            {isFolder ? "delete" : "unfollow"} &quot;{itemTitle}
                            &quot;?
                            {isFolder &&
                                " This will also delete all feeds in this folder."}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsDeleteModalOpen(false)}
                            disabled={isProcessingDelete}
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
        </>
    )
}

interface FeedDropdownMenuProps {
    /** Whether this is a folder or feed item */
    isFolder: boolean
    /** Whether the item is currently active */
    itemActive?: boolean
    /** Folder ID for context */
    folderId?: string
    /** The ID of the item */
    itemId?: string
    /** The title/name of the item */
    itemTitle?: string
    /** Whether the item is favorited */
    isFavorite?: boolean
    /** Whether this is the "All" special item */
    isAll?: boolean
    /** Unread count for the item */
    count?: number | null
    /** Callback for adding a new feed to folder */
    onAddFeed?: (folderId: string) => void
}

/**
 * Dropdown menu wrapper component that handles both context menu and count display.
 * Shows context menu for both feeds and folders. Only excludes special items like "All".
 */
export function FeedDropdownMenu({
    isFolder,
    itemId,
    itemTitle,
    isFavorite,
    isAll,
    count,
}: FeedDropdownMenuProps) {
    // Don't show context menu for special items (All), only count
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

    // Show context menu for both feeds and folders with valid itemId
    if (!itemId) {
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
