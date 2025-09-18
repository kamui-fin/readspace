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
import { useDeleteFeed, type Feed } from "@readspace/shared"

interface FeedDeleteModalProps {
    /** Whether the modal is open */
    isOpen: boolean
    /** Feed to delete */
    feed: Feed | null
    /** Callback when modal should close */
    onClose: () => void
    /** Callback when feed is successfully deleted */
    onDeleted?: (feedId: string) => void
}

/**
 * Modal component for confirming feed deletion.
 * Provides clear warning about the destructive action and handles the delete mutation.
 */
export function FeedDeleteModal({
    isOpen,
    feed,
    onClose,
    onDeleted,
}: FeedDeleteModalProps) {
    const deleteFeedMutation = useDeleteFeed()

    /**
     * Handle delete confirmation
     */
    const handleDelete = () => {
        if (!feed) return

        deleteFeedMutation.mutate(
            { feedId: feed.id, silent: false },
            {
                onSuccess: () => {
                    onClose()
                    onDeleted?.(feed.id)
                },
                onError: () => {
                    onClose()
                },
            }
        )
    }

    if (!feed) return null

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Delete Feed: {feed.title}?</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to unfollow and delete this feed?
                        This action cannot be undone. All downloaded articles
                        for this feed will also be removed.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={deleteFeedMutation.status === "pending"}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={deleteFeedMutation.status === "pending"}
                    >
                        {deleteFeedMutation.status === "pending"
                            ? "Deleting..."
                            : "Delete Feed"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
