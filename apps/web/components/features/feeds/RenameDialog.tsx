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
import { useUpdateFeed, useUpdateFolder, ApiError } from "@readspace/shared"
import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"

interface RenameDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    itemId: string
    itemTitle: string
    isFolder: boolean
}

export function RenameDialog({
    isOpen,
    onOpenChange,
    itemId,
    itemTitle,
    isFolder,
}: RenameDialogProps) {
    const [newName, setNewName] = useState("")

    const updateFeed = useUpdateFeed()
    const updateFolder = useUpdateFolder()

    // Reset name when dialog opens
    useEffect(() => {
        if (isOpen && itemTitle) {
            setNewName(itemTitle)
        }
    }, [isOpen, itemTitle])

    const handleRenameSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (newName.trim() && itemId) {
            if (isFolder) {
                updateFolder.mutate(
                    { folderId: itemId, name: newName.trim() },
                    {
                        onSuccess: () => {
                            onOpenChange(false)
                            setNewName("")
                            toast.success("Folder renamed successfully!")
                        },
                        onError: (error: unknown) => {
                            const message =
                                error instanceof ApiError
                                    ? error.message
                                    : "Failed to rename folder. Please try again."
                            toast.error(message)
                        },
                    }
                )
            } else {
                updateFeed.mutate(
                    { feedId: itemId, data: { custom_title: newName.trim() } },
                    {
                        onSuccess: () => {
                            onOpenChange(false)
                            setNewName("")
                            toast.success("Feed renamed successfully!")
                        },
                    }
                )
            }
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        Rename {isFolder ? "Folder" : "Feed"}
                    </DialogTitle>
                    <DialogDescription>
                        Enter a new name for this {isFolder ? "folder" : "feed"}
                        .
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleRenameSubmit}>
                    <div className="grid gap-4 py-4">
                        <Input
                            id="rename-input"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder={`${isFolder ? "Folder" : "Feed"} name`}
                            autoFocus
                            disabled={
                                updateFeed.status === "pending" ||
                                updateFolder.status === "pending"
                            }
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={
                                updateFeed.status === "pending" ||
                                updateFolder.status === "pending"
                            }
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                !newName.trim() ||
                                updateFeed.status === "pending" ||
                                updateFolder.status === "pending"
                            }
                        >
                            {updateFeed.status === "pending" ||
                            updateFolder.status === "pending"
                                ? "Renaming..."
                                : "Rename"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
