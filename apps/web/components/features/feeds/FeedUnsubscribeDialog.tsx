import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useDeleteFeed, type FeedSummary } from "@readspace/shared"
import { Loader2, Trash2 } from "lucide-react"
import { useState } from "react"

interface FeedUnsubscribeDialogProps {
    isOpen: boolean
    onClose: () => void
    feed: FeedSummary
    subscriptionId?: string
}

export function FeedUnsubscribeDialog({
    isOpen,
    onClose,
    feed,
    subscriptionId,
}: FeedUnsubscribeDialogProps) {
    const [isProcessing, setIsProcessing] = useState(false)
    const deleteFeed = useDeleteFeed()

    const handleConfirm = async () => {
        if (!subscriptionId) return

        setIsProcessing(true)
        try {
            await deleteFeed.mutateAsync({ feedId: subscriptionId })
            onClose()
        } catch {
            // Error toast is handled by the mutation
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Trash2 className="h-5 w-5 text-destructive" />
                        Unfollow Feed
                    </DialogTitle>
                    <DialogDescription>
                        Are you sure you want to unfollow &quot;
                        {feed.title || "this feed"}&quot;? You will no longer
                        receive new articles from this feed.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isProcessing}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isProcessing}
                        variant="destructive"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Unfollowing...
                            </>
                        ) : (
                            "Unfollow"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
