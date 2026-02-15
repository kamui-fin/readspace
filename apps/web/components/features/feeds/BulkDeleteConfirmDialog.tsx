import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

interface BulkDeleteConfirmDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    count: number
    onConfirm: () => void
    isProcessing: boolean
}

export function BulkDeleteConfirmDialog({
    isOpen,
    onOpenChange,
    count,
    onConfirm,
    isProcessing,
}: BulkDeleteConfirmDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Delete {count} Feeds</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete {count} selected
                        feed(s)? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isProcessing}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={isProcessing}
                        variant="destructive"
                    >
                        {isProcessing ? "Deleting..." : "Delete Feeds"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
