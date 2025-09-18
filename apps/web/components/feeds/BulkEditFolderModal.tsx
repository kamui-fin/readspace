"use client"

import { useState } from "react"
import { toast } from "react-hot-toast"
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useUpdateFeed } from "@readspace/shared"

interface BulkEditFolderModalProps {
    /** Whether the modal is open */
    isOpen: boolean
    /** Array of selected feed IDs */
    selectedFeedIds: string[]
    /** Available folders for selection */
    folders: Array<{ id: string; name: string }>
    /** Callback when modal should close */
    onClose: () => void
    /** Callback when bulk operation completes */
    onComplete?: () => void
}

/**
 * Modal component for bulk editing the folder assignment of multiple feeds.
 * Handles batch updates and provides progress feedback.
 */
export function BulkEditFolderModal({
    isOpen,
    selectedFeedIds,
    folders,
    onClose,
    onComplete,
}: BulkEditFolderModalProps) {
    const [targetBulkFolderId, setTargetBulkFolderId] = useState<string | null>(
        null
    )
    const updateFeedMutation = useUpdateFeed()

    /**
     * Handle modal close with state cleanup
     */
    const handleClose = (open: boolean) => {
        if (!open) {
            setTargetBulkFolderId(null)
            onClose()
        }
    }

    /**
     * Handle bulk folder change
     */
    const handleBulkFolderChange = async () => {
        if (!targetBulkFolderId) {
            toast.error("Please select a target folder.")
            return
        }

        const updates = selectedFeedIds.map((feedId) =>
            updateFeedMutation.mutateAsync({
                feedId,
                data: {
                    folder_id:
                        targetBulkFolderId === "none"
                            ? undefined
                            : targetBulkFolderId,
                },
                silent: true, // Suppress individual toasts for bulk operation
            })
        )

        try {
            await toast.promise(Promise.allSettled(updates), {
                loading: `Moving ${selectedFeedIds.length} feeds...`,
                success: (results) => {
                    const successfulCount = results.filter(
                        (r) => r.status === "fulfilled"
                    ).length
                    const failedCount = results.length - successfulCount

                    setTargetBulkFolderId(null)
                    onComplete?.()
                    handleClose(false)

                    return `Moved ${successfulCount} feeds. ${
                        failedCount > 0 ? `${failedCount} failed.` : ""
                    }`
                },
                error: "An unexpected error occurred while moving feeds.",
            })
        } catch (error) {
            console.error("Bulk folder change error:", error)
        }
    }

    /**
     * Handle cancel with cleanup
     */
    const handleCancel = () => {
        setTargetBulkFolderId(null)
        handleClose(false)
    }

    if (selectedFeedIds.length === 0) return null

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        Change Folder for {selectedFeedIds.length} Feed(s)
                    </DialogTitle>
                    <DialogDescription>
                        Select a new folder for the selected feeds. This will
                        update all selected feeds.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Select
                        onValueChange={(newFolderId) => {
                            setTargetBulkFolderId(newFolderId)
                        }}
                        value={targetBulkFolderId || ""}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select new folder" />
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
                </div>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={updateFeedMutation.status === "pending"}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleBulkFolderChange}
                        disabled={
                            !targetBulkFolderId ||
                            updateFeedMutation.status === "pending"
                        }
                    >
                        {updateFeedMutation.status === "pending"
                            ? "Moving..."
                            : "Move Feeds"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
