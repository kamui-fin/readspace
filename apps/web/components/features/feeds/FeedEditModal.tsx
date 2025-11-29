"use client"

import { useState, useEffect } from "react"
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
import { Input } from "@/components/ui/input"
import { useUpdateFeed, type FeedSummary } from "@readspace/shared"

interface FeedEditModalProps {
    /** Whether the modal is open */
    isOpen: boolean
    /** Feed to edit */
    feed: FeedSummary | null
    /** Callback when modal should close */
    onClose: () => void
}

/**
 * Modal component for editing feed details (currently just title).
 * Provides form validation and handles the update mutation.
 */
export function FeedEditModal({ isOpen, feed, onClose }: FeedEditModalProps) {
    const [editFeedTitle, setEditFeedTitle] = useState("")
    const updateFeedMutation = useUpdateFeed()

    // Update local state when feed changes
    useEffect(() => {
        if (feed) {
            setEditFeedTitle(feed.title || "")
        }
    }, [feed])

    /**
     * Handle form submission
     */
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (!feed) return

        if (!editFeedTitle.trim()) {
            toast.error("Title cannot be empty.")
            return
        }

        updateFeedMutation.mutate(
            {
                feedId: feed.id,
                data: {
                    custom_title: editFeedTitle.trim(),
                },
            },
            {
                onSuccess: () => {
                    onClose()
                },
            }
        )
    }

    /**
     * Handle modal close with cleanup
     */
    const handleClose = () => {
        setEditFeedTitle("")
        onClose()
    }

    /**
     * Check if form has changes
     */
    const hasChanges = feed && editFeedTitle.trim() !== (feed.title || "")

    if (!feed) return null

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Feed: {feed.title}</DialogTitle>
                    <DialogDescription>
                        Current URL: {feed.url}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="py-4">
                        <label
                            htmlFor="feedTitle"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                            Feed Title
                        </label>
                        <Input
                            id="feedTitle"
                            value={editFeedTitle}
                            onChange={(e) => setEditFeedTitle(e.target.value)}
                            placeholder="Enter new feed title"
                            autoFocus
                            disabled={updateFeedMutation.status === "pending"}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={updateFeedMutation.status === "pending"}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                updateFeedMutation.status === "pending" ||
                                !editFeedTitle.trim() ||
                                !hasChanges
                            }
                        >
                            {updateFeedMutation.status === "pending"
                                ? "Saving..."
                                : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
