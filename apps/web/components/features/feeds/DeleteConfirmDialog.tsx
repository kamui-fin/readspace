import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useDeleteFeed, useDeleteFolder } from "@readspace/shared"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "react-hot-toast"

interface DeleteConfirmDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    itemId: string
    itemTitle: string
    isFolder: boolean
}

export function DeleteConfirmDialog({
    isOpen,
    onOpenChange,
    itemId,
    itemTitle,
    isFolder,
}: DeleteConfirmDialogProps) {
    const [isProcessingDelete, setIsProcessingDelete] = useState(false)

    const deleteFeed = useDeleteFeed()
    const deleteFolder = useDeleteFolder()
    const router = useRouter()
    const pathname = usePathname()

    const handleDeleteConfirm = async () => {
        if (!itemId) return
        setIsProcessingDelete(true)

        // Navigate away if currently viewing the item being deleted
        if (isFolder && pathname.includes(`/folders/${itemId}`)) {
            router.push("/today")
        } else if (!isFolder && pathname.includes(itemId)) {
            router.push("/today")
        }

        try {
            if (isFolder) {
                await deleteFolder.mutateAsync(itemId)
                toast.success("Folder deleted successfully!")
            } else {
                await deleteFeed.mutateAsync({ feedId: itemId })
                toast.success("Feed unfollowed successfully!")
            }
            onOpenChange(false)
        } catch (error: unknown) {
            // Error toast is handled by the mutation
            console.error("Failed to delete item:", error)
        } finally {
            setIsProcessingDelete(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        {isFolder ? "Delete Folder" : "Unfollow Feed"}
                    </DialogTitle>
                    <DialogDescription>
                        Are you sure you want to{" "}
                        {isFolder ? "delete" : "unfollow"} &quot;{itemTitle}
                        &quot;?
                        {isFolder &&
                            " This will also delete all feeds in this folder."}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isProcessingDelete}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteConfirm}
                        disabled={isProcessingDelete}
                        variant="destructive"
                    >
                        {isProcessingDelete
                            ? "Processing..."
                            : isFolder
                              ? "Delete"
                              : "Unfollow"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
