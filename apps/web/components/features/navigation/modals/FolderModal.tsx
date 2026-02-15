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
import { useCreateFolder } from "@readspace/shared"

interface FolderModalProps {
    /** Whether the modal is open */
    isOpen: boolean
    /** Function to close the modal */
    onClose: () => void
}

/**
 * Modal component for creating new folders.
 * Handles form submission and error states.
 */
export function FolderModal({ isOpen, onClose }: FolderModalProps) {
    const [folderName, setFolderName] = useState("")
    const createFolder = useCreateFolder()

    /**
     * Handle form submission for creating a new folder
     */
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!folderName.trim()) return

        createFolder.mutate(
            { name: folderName.trim() },
            {
                onSuccess: () => {
                    setFolderName("")
                    onClose()
                    toast.success("Folder created successfully!")
                },
                onError: (error) => {
                    console.error("Failed to create folder:", error)
                    toast.error("Failed to create folder. Please try again.")
                },
            }
        )
    }

    /**
     * Handle modal close with cleanup
     */
    const handleClose = () => {
        setFolderName("")
        createFolder.reset()
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Folder</DialogTitle>
                    <DialogDescription>
                        Create a new folder to organize your RSS feeds. You can
                        move feeds into folders later.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <Input
                            id="folder-name"
                            value={folderName}
                            onChange={(e) => setFolderName(e.target.value)}
                            placeholder="Folder name (e.g., Tech News, Sports)"
                            autoFocus
                            disabled={createFolder.status === "pending"}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={createFolder.status === "pending"}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                !folderName.trim() ||
                                createFolder.status === "pending"
                            }
                        >
                            {createFolder.status === "pending"
                                ? "Creating..."
                                : "Create Folder"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
