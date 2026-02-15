import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { type FeedDetail, type FeedSummary } from "@readspace/shared"
import { EditFeedForm } from "./EditFeedForm"

interface EditFeedDialogProps {
    feed: FeedSummary &
        Partial<
            Pick<
                FeedDetail,
                | "description"
                | "language"
                | "top_level_category"
                | "popularity_score"
            >
        >
    isOpen: boolean
    onClose: () => void
}

export function EditFeedDialog({ feed, isOpen, onClose }: EditFeedDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Feed</DialogTitle>
                    <DialogDescription>
                        Update feed properties. These changes will affect the
                        global feed for all users.
                    </DialogDescription>
                </DialogHeader>

                <EditFeedForm feed={feed} onClose={onClose} />
            </DialogContent>
        </Dialog>
    )
}
