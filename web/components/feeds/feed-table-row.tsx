"use client"

import { formatDistanceToNow, parseISO } from "date-fns"
import {
    AlertTriangle,
    CheckCircle,
    Edit3,
    ExternalLink,
    MoreHorizontal,
    Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { Checkbox } from "@/components/ui/checkbox"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { TableCell, TableRow } from "@/components/ui/table"
import type { Feed } from "@readspace/shared"

interface FeedTableRowProps {
    /** Feed data to display */
    feed: Feed
    /** Whether this row is selected */
    isSelected: boolean
    /** Available folders for folder selection */
    folders: Array<{ id: string; name: string }>
    /** Callback when row selection changes */
    onSelectionChange: (feedId: string, isSelected: boolean) => void
    /** Callback when folder is changed */
    onFolderChange: (feedId: string, newFolderId: string | null) => void
    /** Callback when edit action is triggered */
    onEdit: (feed: Feed) => void
    /** Callback when delete action is triggered */
    onDelete: (feed: Feed) => void
}

/**
 * Individual table row component for displaying feed information and actions.
 * Handles feed status display, folder management, and action menu.
 */
export function FeedTableRow({
    feed,
    isSelected,
    folders,
    onSelectionChange,
    onFolderChange,
    onEdit,
    onDelete,
}: FeedTableRowProps) {
    /**
     * Determine if a feed should be considered "dead" based on error count and last activity
     */
    const isFeedDead = (feed: Feed): boolean => {
        if (feed.fetch_error_count > 5) return true

        if (feed.last_article_published_at) {
            const ninetyDaysAgo = new Date()
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
            if (parseISO(feed.last_article_published_at) < ninetyDaysAgo) {
                return true
            }
        } else {
            // If no last_article_published_at and it has been fetched, it might be dead
            if (feed.last_fetched_at && feed.fetch_error_count === 0) {
                const ninetyDaysAgo = new Date()
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
                if (parseISO(feed.last_fetched_at) < ninetyDaysAgo) return true
            }
        }
        return false
    }

    /**
     * Handle selection checkbox change
     */
    const handleSelectionChange = (checked: boolean) => {
        onSelectionChange(feed.id, checked)
    }

    /**
     * Handle folder selection change
     */
    const handleFolderChange = (newFolderId: string) => {
        if (newFolderId === "none") {
            onFolderChange(feed.id, null)
        } else {
            onFolderChange(feed.id, newFolderId)
        }
    }

    /**
     * Handle edit button click
     */
    const handleEdit = () => {
        onEdit(feed)
    }

    /**
     * Handle delete button click
     */
    const handleDelete = () => {
        onDelete(feed)
    }

    const isDead = isFeedDead(feed)

    return (
        <TableRow data-state={isSelected ? "selected" : undefined}>
            {/* Selection checkbox */}
            <TableCell>
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={handleSelectionChange}
                    aria-label={`Select row for ${feed.title}`}
                />
            </TableCell>

            {/* Feed title and URL */}
            <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                    {feed.image_url && (
                        <Image
                            src={feed.image_url}
                            alt=""
                            width={20}
                            height={20}
                            className="h-5 w-5 rounded-sm object-cover"
                        />
                    )}
                    <div className="flex flex-col">
                        <span
                            className="whitespace-nowrap"
                            title={feed.title || "N/A"}
                        >
                            {feed.title || "N/A"}
                        </span>
                        <a
                            href={feed.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary whitespace-nowrap"
                            title={feed.url}
                        >
                            {feed.url}{" "}
                            <ExternalLink className="inline h-3 w-3 ml-0.5" />
                        </a>
                    </div>
                </div>
            </TableCell>

            {/* Folder selection */}
            <TableCell>
                <Select
                    value={feed.folder_id || "none"}
                    onValueChange={handleFolderChange}
                >
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select folder" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">No folder</SelectItem>
                        {folders.map((folder) => (
                            <SelectItem key={folder.id} value={folder.id}>
                                {folder.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </TableCell>

            {/* Status badge */}
            <TableCell className="text-center">
                {isDead ? (
                    <Badge
                        variant="destructive"
                        className="whitespace-nowrap"
                        title={`Error count: ${feed.fetch_error_count}. ${feed.last_error_message || ""}`}
                    >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Dead
                    </Badge>
                ) : feed.fetch_error_count > 0 ? (
                    <Badge
                        variant="secondary" // Changed from "orange" which may not exist
                        className="whitespace-nowrap"
                        title={`Error count: ${feed.fetch_error_count}. ${feed.last_error_message || ""}`}
                    >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Warning
                    </Badge>
                ) : (
                    <Badge variant="secondary" className="whitespace-nowrap">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                    </Badge>
                )}
            </TableCell>

            {/* Last post date */}
            <TableCell className="text-right text-xs">
                {feed.last_article_published_at ? (
                    <div className="text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(
                            parseISO(feed.last_article_published_at),
                            { addSuffix: true }
                        )}
                    </div>
                ) : (
                    <div className="text-muted-foreground whitespace-nowrap">
                        No posts yet
                    </div>
                )}
            </TableCell>

            {/* Actions dropdown */}
            <TableCell className="text-right">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Actions for ${feed.title}`}
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleEdit}>
                            <Edit3 className="mr-2 h-4 w-4" />
                            Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={handleDelete}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Feed
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
        </TableRow>
    )
}
