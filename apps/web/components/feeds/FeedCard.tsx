import { EditFeedDialog } from "@/components/feeds/EditFeedDialog"
import { FeedSubscriptionModal } from "@/components/FeedSubscriptionModal"
import { useUserRole } from "@/hooks/useUserRole"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    useAdminDeleteFeed,
    useDeleteFeed,
    useFeeds,
    type Feed,
    type FeedDiscoveryResult,
} from "@readspace/shared"
import { MoreVertical, Pencil, Trash2 } from "lucide-react"
import NextImage from "next/image"
import Link from "next/link"
import { useState } from "react"

interface FeedCardProps {
    feed: Feed | FeedDiscoveryResult
    showFollowButton?: boolean
    showSimilarButton?: boolean
    showPreviewButton?: boolean
}

export function FeedCard({
    feed,
    showFollowButton = true,
    showSimilarButton = true,
    showPreviewButton = true,
}: FeedCardProps) {
    // Get the user's subscribed feeds to check if this feed is subscribed
    const { data: feedsData } = useFeeds(
        {},
        {
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000, // 5 minutes
        }
    )

    // Check if this feed is in the user's subscription list
    const isFollowed = feedsData?.some((f) => f.id === feed.id) ?? false

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isUnsubscribeModalOpen, setIsUnsubscribeModalOpen] = useState(false)
    const [isProcessingUnsubscribe, setIsProcessingUnsubscribe] =
        useState(false)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const deleteFeed = useDeleteFeed()
    const adminDeleteFeed = useAdminDeleteFeed()
    const { isAdmin } = useUserRole()

    const handleFollowClick = () => {
        if (isFollowed) {
            setIsUnsubscribeModalOpen(true)
        } else {
            setIsModalOpen(true)
        }
    }

    const handleUnsubscribeConfirm = async () => {
        setIsProcessingUnsubscribe(true)

        try {
            await deleteFeed.mutateAsync({ feedId: feed.id })
            setIsUnsubscribeModalOpen(false)
        } catch {
            // Error toast is handled by the mutation
        } finally {
            setIsProcessingUnsubscribe(false)
        }
    }

    const handleSubscriptionSuccess = () => {
        // No need to set local state - the subscription mutation should update the feeds query data
        // which will cause useIsSubscribed to return the updated value
    }

    const handleAdminDelete = () => {
        // Delete immediately without confirmation
        adminDeleteFeed.mutate({ feedId: feed.id })
    }

    return (
        <div className="p-2 md:p-4 w-full">
            <div className="flex gap-3 md:gap-4 w-full min-w-0">
                <div className="relative flex-shrink-0">
                    {feed.image_url && (
                        <NextImage
                            src={feed.image_url}
                            alt={feed.title || "Feed icon"}
                            className="w-8 h-8 md:w-9 md:h-9 rounded object-cover"
                            width={36}
                            height={36}
                            onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = "none"
                                const fallback =
                                    target.nextElementSibling as HTMLElement
                                if (fallback) fallback.style.display = "flex"
                            }}
                        />
                    )}
                    <div
                        className={`w-8 h-8 md:w-9 md:h-9 rounded flex items-center justify-center text-white font-bold text-xs md:text-sm ${
                            feed.title?.toLowerCase().includes("techcrunch")
                                ? "bg-green-600"
                                : feed.title
                                        ?.toLowerCase()
                                        .includes("hacker news")
                                  ? "bg-orange-500"
                                  : "bg-gray-600"
                        }`}
                        style={{ display: feed.image_url ? "none" : "flex" }}
                    >
                        {feed.title?.toLowerCase().includes("techcrunch")
                            ? "TC"
                            : feed.title?.toLowerCase().includes("hacker news")
                              ? "Y"
                              : feed.title
                                ? feed.title.charAt(0).toUpperCase()
                                : "F"}
                    </div>
                </div>

                <div className="flex-1 min-w-0 max-w-full">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between md:gap-4">
                        <div className="flex-1 min-w-0 max-w-full">
                            <h3
                                className="font-semibold text-lg text-black dark:text-foreground leading-tight break-words hyphens-auto"
                                style={{
                                    wordWrap: "break-word",
                                    overflowWrap: "anywhere",
                                }}
                            >
                                {feed.title || "Untitled Feed"}
                            </h3>
                            <a
                                href={feed.link || feed.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#BDC6B7] dark:text-secondary mt-0.5 block break-all"
                                style={{ wordBreak: "break-all" }}
                            >
                                {(feed.link || feed.url)
                                    ?.replace(/^https?:\/\//, "")
                                    .replace(/\/$/, "") || "No URL"}
                            </a>
                            {feed.description && (
                                <p
                                    className="text-xs text-[#91998C] mt-2 leading-relaxed break-words"
                                    style={{
                                        wordWrap: "break-word",
                                        overflowWrap: "anywhere",
                                        display: "-webkit-box",
                                        WebkitLineClamp: 3,
                                        WebkitBoxOrient: "vertical",
                                        overflow: "hidden",
                                    }}
                                >
                                    {feed.description}
                                </p>
                            )}
                        </div>

                        <div className="hidden md:flex items-center gap-4 flex-shrink-0">
                            {showSimilarButton && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-[#91998C] hover:text-[#6A994E] text-xs px-2 py-1 h-auto font-normal"
                                    asChild
                                >
                                    <Link href={`/feeds/${feed.id}/similar`}>
                                        Similar Feeds
                                    </Link>
                                </Button>
                            )}
                            {showFollowButton && (
                                <Button
                                    variant={
                                        isFollowed ? "outline" : "secondary"
                                    }
                                    onClick={handleFollowClick}
                                    className={`h-8 text-xs ${isFollowed ? "text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/10" : ""}`}
                                >
                                    {isFollowed && (
                                        <Trash2 className="mr-1 h-3 w-3" />
                                    )}
                                    {isFollowed ? "Unfollow" : "Follow"}
                                </Button>
                            )}
                            {isAdmin && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                            <span className="sr-only">
                                                Admin controls
                                            </span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            onClick={() =>
                                                setIsEditDialogOpen(true)
                                            }
                                        >
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={handleAdminDelete}
                                            className="text-destructive focus:text-destructive"
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 gap-2">
                        {showPreviewButton && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-primary hover:text-primary/80 dark:text-secondary dark:hover:text-secondary/80 text-xs px-0 py-1 h-auto font-normal"
                                asChild
                            >
                                <Link
                                    href={
                                        isFollowed
                                            ? `/feeds/${feed.id}/articles`
                                            : `/feeds/${feed.id}/preview`
                                    }
                                >
                                    {isFollowed ? "View" : "Preview"}
                                </Link>
                            </Button>
                        )}

                        <div className="md:hidden flex items-center gap-2 flex-shrink-0">
                            {showSimilarButton && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-[#91998C] hover:text-[#6A994E] text-xs px-2 py-1 h-auto font-normal"
                                    asChild
                                >
                                    <Link href={`/feeds/${feed.id}/similar`}>
                                        Similar Feeds
                                    </Link>
                                </Button>
                            )}
                            {showFollowButton && (
                                <Button
                                    variant={
                                        isFollowed ? "outline" : "secondary"
                                    }
                                    onClick={handleFollowClick}
                                    className={`h-8 text-xs ${isFollowed ? "text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/10" : ""}`}
                                >
                                    {isFollowed && (
                                        <Trash2 className="mr-1 h-3 w-3" />
                                    )}
                                    {isFollowed ? "Unfollow" : "Follow"}
                                </Button>
                            )}
                            {isAdmin && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                            <span className="sr-only">
                                                Admin controls
                                            </span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            onClick={() =>
                                                setIsEditDialogOpen(true)
                                            }
                                        >
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={handleAdminDelete}
                                            className="text-destructive focus:text-destructive"
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <FeedSubscriptionModal
                feed={feed}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleSubscriptionSuccess}
            />

            {/* Unsubscribe Modal */}
            <Dialog
                open={isUnsubscribeModalOpen}
                onOpenChange={setIsUnsubscribeModalOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Unfollow Feed</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to unfollow &quot;
                            {feed.title || "this feed"}&quot;? You will no
                            longer receive new articles from this feed.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsUnsubscribeModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUnsubscribeConfirm}
                            disabled={isProcessingUnsubscribe}
                            variant="destructive"
                        >
                            {isProcessingUnsubscribe
                                ? "Unfollowing..."
                                : "Unfollow"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Feed Dialog */}
            <EditFeedDialog
                feed={feed}
                isOpen={isEditDialogOpen}
                onClose={() => setIsEditDialogOpen(false)}
            />
        </div>
    )
}
