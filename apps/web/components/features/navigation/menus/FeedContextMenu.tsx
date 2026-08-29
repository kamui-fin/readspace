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
    const hasCount = count != null && count > 0

    // Don't show context menu for special items (All), only count
    if (isAll || !itemId) {
        return hasCount ? (
            <span className="text-xs font-semibold text-muted-foreground/80 px-1.5 py-0.5 rounded-full bg-muted/40 backdrop-blur-xs select-none">
                {count}
            </span>
        ) : null
    }

    return (
        <div className="relative flex items-center justify-end h-6 w-6">
            {/* Count Badge - fades out in place only while the row is hovered, to
                make room for the three-dots menu. It must NOT hide on
                `group-focus-within`: clicking a row (feed or folder) leaves that
                row's link/button focused for as long as it stays selected, which
                would keep the unread count hidden the whole time. */}
            {hasCount && (
                <span
                    className={cn(
                        "text-xs font-semibold text-muted-foreground/80 px-1.5 py-0.5 rounded-full bg-muted/40 backdrop-blur-xs select-none",
                        "transition-opacity duration-150 absolute right-0",
                        "group-hover/item:opacity-0 group-hover/item:pointer-events-none"
                    )}
                >
                    {count}
                </span>
            )}

            {/* Context Menu Button - reveals on row hover, or on keyboard focus
                landing on the trigger itself (`focus-within` scoped to this
                wrapper, not the whole row). */}
            <div
                className={cn(
                    "transition-all duration-200 absolute right-0",
                    "opacity-0 pointer-events-none scale-90 group-hover/item:opacity-100 group-hover/item:pointer-events-auto group-hover/item:scale-100",
                    "focus-within:opacity-100 focus-within:pointer-events-auto focus-within:scale-100",
                    "has-[[data-state=open]]:opacity-100 has-[[data-state=open]]:pointer-events-auto has-[[data-state=open]]:scale-100"
                )}
            >
                <FeedContextMenu
                    isFolder={isFolder}
                    itemId={itemId}
                    itemTitle={itemTitle}
                    isFavorite={isFavorite}
                />
            </div>
        </div>
    )
}
