"use client"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DeleteConfirmDialog } from "@/components/features/feeds/DeleteConfirmDialog"
import { RenameDialog } from "@/components/features/feeds/RenameDialog"
import { useFeedContextMenu } from "@/components/features/feeds/hooks/use-feed-context-menu"
import { cn } from "@/lib/utils"
import { MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react"

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
    isFavorite,
}: FeedContextMenuProps) {
    const {
        isRenameModalOpen,
        setIsRenameModalOpen,
        isDeleteModalOpen,
        setIsDeleteModalOpen,
        isDropdownOpen,
        setIsDropdownOpen,
        handleRename,
        handleDelete,
        handleToggleFavorite,
    } = useFeedContextMenu({
        itemId,
        itemTitle,
        isFolder,
        isFavorite,
    })

    // Don't render if no item ID provided
    if (!itemId) return null

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
                            "hover:bg-[var(--nav-hover)]",
                            "active:bg-[var(--nav-hover)/0.8]",
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
                    {/* Only show favorite option for feeds, not folders */}
                    {!isFolder && (
                        <DropdownMenuItem onClick={handleToggleFavorite}>
                            <Star
                                className={`mr-2 h-4 w-4 ${isFavorite ? "fill-yellow-500 text-yellow-500" : ""}`}
                            />
                            <span>
                                {isFavorite
                                    ? "Remove from favorites"
                                    : "Add to favorites"}
                            </span>
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
            <RenameDialog
                isOpen={isRenameModalOpen}
                onOpenChange={setIsRenameModalOpen}
                itemId={itemId}
                itemTitle={itemTitle || ""}
                isFolder={isFolder}
            />

            {/* Delete Confirmation Modal */}
            <DeleteConfirmDialog
                isOpen={isDeleteModalOpen}
                onOpenChange={setIsDeleteModalOpen}
                itemId={itemId}
                itemTitle={itemTitle || ""}
                isFolder={isFolder}
            />
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
