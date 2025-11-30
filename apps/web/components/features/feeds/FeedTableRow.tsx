"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { formatDistanceToNow, parseISO } from "date-fns"
import { useEffect, useState } from "react"
import {
    AlertTriangle,
    CheckCircle,
    Edit3,
    ExternalLink,
    MoreHorizontal,
    Trash2,
    AlertCircle,
} from "lucide-react"
import { FeedIcon } from "@/components/features/feeds/FeedIcon"

// Custom hook to handle time formatting without hydration issues
function useRelativeTime(dateString: string | null | undefined) {
    const [timeString, setTimeString] = useState<string | null>(null)
    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        setIsClient(true)
        if (dateString) {
            setTimeString(
                formatDistanceToNow(parseISO(dateString), { addSuffix: true })
            )
        }
    }, [dateString])

    if (!isClient || !dateString) {
        return null
    }

    return timeString
}

export interface FeedRowData {
    id: string
    title: string
    url: string
    link: string | null
    folder_id: string | null
    image_url: string | null
    is_favorite: boolean
    error_count: number
    last_updated_at: string | null
    last_error_message: string | null
}

interface FeedTableRowProps {
    /** Feed data to display */
    feed: FeedRowData
    /** Whether this row is selected */
    isSelected: boolean
    /** Available folders for folder selection */
    folders: Array<{ id: string; name: string }>
    /** Callback when row selection changes */
    onSelectionChange: (feedId: string, isSelected: boolean) => void
    /** Callback when folder is changed */
    onFolderChange: (feedId: string, newFolderId: string | null) => void
    /** Callback when edit action is triggered */
    onEdit: (feed: FeedRowData) => void
    /** Callback when delete action is triggered */
    onDelete: (feed: FeedRowData) => void
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
    // Use the hydration-safe relative time hook
    const relativeTime = useRelativeTime(feed.last_updated_at)

    /**
     * Determine if a feed should be considered "dead" based on error count and last activity
     */
    const isFeedDead = (feed: FeedRowData): boolean => {
        if ((feed.error_count || 0) > 5) return true

        if (feed.last_updated_at) {
            const ninetyDaysAgo = new Date()
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
            if (parseISO(feed.last_updated_at) < ninetyDaysAgo) {
                return true
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
        if (newFolderId === "unorganized") {
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
    const errorCount = feed.error_count || 0

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
                    <FeedIcon feed={feed} className="h-5 w-5 rounded-sm" />
                    <div className="flex flex-col">
                        <span
                            className="whitespace-nowrap"
                            title={feed.title || "N/A"}
                        >
                            {feed.title || "N/A"}
                        </span>
                        {errorCount > 0 && (
                            <span
                                className="flex items-center text-destructive text-xs"
                                title={feed.last_error_message || "Fetch error"}
                            >
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {errorCount} errors
                            </span>
                        )}
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
                    value={feed.folder_id || "unorganized"}
                    onValueChange={handleFolderChange}
                >
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select folder" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="unorganized">Unorganized</SelectItem>
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
                        title={`Error count: ${errorCount}. ${feed.last_error_message || ""}`}
                    >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Dead
                    </Badge>
                ) : errorCount > 0 ? (
                    <Badge
                        variant="secondary"
                        className="whitespace-nowrap"
                        title={`Error count: ${errorCount}. ${feed.last_error_message || ""}`}
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
            <TableCell className="hidden md:table-cell text-muted-foreground text-right text-xs">
                {relativeTime || "Never"}
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
