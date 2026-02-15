import { useBulkDeleteFeeds, useUpdateFeed } from "@readspace/shared"
import { useState } from "react"
import { toast } from "react-hot-toast"
import { exportFeedsToOPML } from "@/lib/opml-export"
import type { FeedRowData } from "./use-feed-data"
import type { Folder } from "@readspace/shared"

export function useFeedSelection(feeds: FeedRowData[], folders: Folder[]) {
    // Selection state
    const [selectedFeedIds, setSelectedFeedIds] = useState<string[]>([])

    // Mutations
    const updateFeedMutation = useUpdateFeed()
    const bulkDeleteFeedsMutation = useBulkDeleteFeeds()

    /**
     * Handle select all checkbox
     */
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedFeedIds(feeds.map((feed) => feed.id))
        } else {
            setSelectedFeedIds([])
        }
    }

    /**
     * Handle individual feed selection
     */
    const handleSelectFeed = (feedId: string, checked: boolean) => {
        if (checked) {
            setSelectedFeedIds((prev) => [...prev, feedId])
        } else {
            setSelectedFeedIds((prev) => prev.filter((id) => id !== feedId))
        }
    }

    /**
     * Handle folder change for individual feed
     */
    const handleFolderChange = (feedId: string, newFolderId: string | null) => {
        updateFeedMutation.mutate({
            feedId,
            data: {
                folder_id: newFolderId === null ? undefined : newFolderId,
            },
        })
    }

    /**
     * Handle bulk delete with confirmation
     */
    /**
     * Perform bulk delete
     */
    const performBulkDelete = (onSuccess?: () => void) => {
        if (selectedFeedIds.length === 0) return

        bulkDeleteFeedsMutation.mutate(
            { feedIds: selectedFeedIds },
            {
                onSuccess: () => {
                    setSelectedFeedIds([])
                    onSuccess?.()
                },
            }
        )
    }

    /**
     * Handle OPML export
     */
    const handleExportOPML = () => {
        if (feeds.length === 0) {
            toast.error("No feeds to export")
            return
        }

        try {
            exportFeedsToOPML(feeds, folders)
            toast.success(`Exported ${feeds.length} feeds to OPML`)
        } catch (error) {
            toast.error("Failed to export OPML")
            console.error("OPML export error:", error)
        }
    }

    return {
        selectedFeedIds,
        setSelectedFeedIds,
        handleSelectAll,
        handleSelectFeed,
        handleFolderChange,
        performBulkDelete,
        isBulkDeleting: bulkDeleteFeedsMutation.status === "pending",
        handleExportOPML,
        isAllSelected:
            selectedFeedIds.length === feeds.length && feeds.length > 0,
    }
}
