import { BaseFeedCard } from "./BaseFeedCard"
import { EditFeedDialog } from "./EditFeedDialog"
import { Button } from "@/components/ui/button"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useUserRole } from "@/hooks/use-user-role"
import {
    useAdminDeleteFeed,
    type FeedSummary,
    type FeedDiscoveryResult,
    type ContentType,
} from "@readspace/shared"
import { Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

interface FeedCardProps {
    feed: FeedSummary | FeedDiscoveryResult
    className?: string
    showFollowButton?: boolean
    showSimilarButton?: boolean
    onTagClick?: (tag: string) => void
}

export function FeedCard({
    feed,
    className,
    showFollowButton = true,
    showSimilarButton = true,
    onTagClick,
}: FeedCardProps) {
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const adminDeleteFeed = useAdminDeleteFeed()
    const { isAdmin } = useUserRole()

    const handleAdminDelete = () => {
        if (feed.id) {
            adminDeleteFeed.mutate({ feedId: feed.id })
        }
    }

    // Header actions (Admin actions)
    const cardActions = isAdmin ? (
        <div className="flex items-center gap-1">
            <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setIsEditDialogOpen(true)}
                title="Edit feed"
                aria-label="Edit feed"
            >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit feed</span>
            </Button>
            <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => setIsDeleteConfirmOpen(true)}
                title="Delete feed"
                aria-label="Delete feed"
            >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete feed</span>
            </Button>
        </div>
    ) : null

    // Footer actions ("More like this →" link)
    const similarHref = feed.id
        ? `/feeds/${feed.id}/similar${feed.title ? `?title=${encodeURIComponent(feed.title)}` : ""}`
        : "#"

    const footerActions =
        showSimilarButton && feed.id ? (
            <Link
                href={similarHref}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 group py-0.5 cursor-pointer"
            >
                <span>More like this</span>
                <span className="transition-transform duration-150 group-hover:translate-x-0.5">
                    →
                </span>
            </Link>
        ) : null

    // Normalize the feed to FeedSummary type
    const normalizedFeed: FeedSummary & { description?: string | null } =
        "error_count" in feed
            ? (feed as FeedSummary & { description?: string | null })
            : {
                  // FeedDiscoveryResult -> FeedSummary conversion
                  id: feed.id ?? "",
                  url: feed.url ?? "",
                  title: feed.title,
                  link: feed.link ?? null,
                  image_url: feed.image_url ?? null,
                  description: (feed as FeedDiscoveryResult).description,
                  language: feed.language ?? "en",
                  author: feed.author ?? null,
                  content_type: (feed.content_type as ContentType) ?? null,
                  tags: feed.tags ?? [],
                  tags_native: feed.tags_native ?? [],
              }

    return (
        <>
            <BaseFeedCard
                feed={normalizedFeed}
                variant="default"
                className={className}
                headerActions={cardActions}
                footerActions={footerActions}
                onTagClick={onTagClick}
                showFollowButton={showFollowButton}
            />

            {/* Edit Feed Dialog */}
            <EditFeedDialog
                feed={feed as FeedSummary}
                isOpen={isEditDialogOpen}
                onClose={() => setIsEditDialogOpen(false)}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog
                open={isDeleteConfirmOpen}
                onOpenChange={setIsDeleteConfirmOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Feed</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete &quot;{feed.title}&quot;? This
                            action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleAdminDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
