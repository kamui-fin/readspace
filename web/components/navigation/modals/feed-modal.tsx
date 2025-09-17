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
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useCreateFeed, type Folder } from "@readspace/shared"

interface FeedModalProps {
    /** Whether the modal is open */
    isOpen: boolean
    /** Function to close the modal */
    onClose: () => void
    /** Pre-selected folder ID */
    selectedFolderId?: string | null
    /** Available folders for selection */
    folders: Folder[]
    /** Error message to display */
    error?: string | null
    /** Function to clear error */
    onClearError?: () => void
}

/**
 * Modal component for adding new RSS feeds.
 * Supports folder selection and URL validation.
 */
export function FeedModal({
    isOpen,
    onClose,
    selectedFolderId,
    folders,
    error,
    onClearError,
}: FeedModalProps) {
    const [feedUrl, setFeedUrl] = useState("")
    const [selectedFolder, setSelectedFolder] = useState<string | null>(
        selectedFolderId || null
    )
    const createFeed = useCreateFeed()

    /**
     * Handle form submission for adding a new feed
     */
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!feedUrl.trim()) return

        createFeed.mutate(
            {
                url: feedUrl.trim(),
                folder_id: selectedFolder || undefined,
            },
            {
                onSuccess: () => {
                    setFeedUrl("")
                    setSelectedFolder(selectedFolderId || null)
                    onClearError?.()
                    onClose()
                    toast.success("Feed added successfully!")
                },
                onError: (error) => {
                    console.error("Failed to create feed:", error)
                    // Let the parent component handle the error display
                },
            }
        )
    }

    /**
     * Handle modal close with cleanup
     */
    const handleClose = () => {
        setFeedUrl("")
        setSelectedFolder(selectedFolderId || null)
        createFeed.reset()
        onClearError?.()
        onClose()
    }

    /**
     * Handle URL input change with error clearing
     */
    const handleUrlChange = (value: string) => {
        setFeedUrl(value)
        if (error) {
            onClearError?.()
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add RSS Feed</DialogTitle>
                    <DialogDescription>
                        Add a new RSS feed to your collection. You can organize
                        it into a folder or leave it ungrouped.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="feed-url" className="text-right">
                                URL
                            </label>
                            <Input
                                id="feed-url"
                                value={feedUrl}
                                onChange={(e) =>
                                    handleUrlChange(e.target.value)
                                }
                                className="col-span-3"
                                placeholder="https://example.com/feed.xml"
                                autoFocus
                                disabled={createFeed.status === "pending"}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label
                                htmlFor="folder-select"
                                className="text-right"
                            >
                                Folder
                            </label>
                            <Select
                                value={selectedFolder || "none"}
                                onValueChange={(value) =>
                                    setSelectedFolder(
                                        value === "none" ? null : value
                                    )
                                }
                                disabled={createFeed.status === "pending"}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select a folder (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">
                                        No folder
                                    </SelectItem>
                                    {folders.map((folder) => (
                                        <SelectItem
                                            key={folder.id}
                                            value={folder.id}
                                        >
                                            {folder.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Error display */}
                    {error && (
                        <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                            {error}
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={createFeed.status === "pending"}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                !feedUrl.trim() ||
                                createFeed.status === "pending"
                            }
                        >
                            {createFeed.status === "pending"
                                ? "Adding..."
                                : "Add Feed"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
