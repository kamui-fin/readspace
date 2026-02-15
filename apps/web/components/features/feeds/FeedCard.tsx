import { BaseFeedCard } from "./BaseFeedCard"
import { EditFeedDialog } from "./EditFeedDialog"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUserRole } from "@/hooks/use-user-role"
import {
    useAdminDeleteFeed,
    type FeedSummary,
    type FeedDiscoveryResult,
} from "@readspace/shared"
import { Eye, MoreVertical, Pencil, Sparkles, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

interface FeedCardProps {
    feed: FeedSummary | FeedDiscoveryResult
    className?: string
    showFollowButton?: boolean
    showSimilarButton?: boolean
    showPreviewButton?: boolean
}

export function FeedCard({
    feed,
    className,
    showFollowButton = true,
    showSimilarButton = true,
    showPreviewButton = true,
}: FeedCardProps) {
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const adminDeleteFeed = useAdminDeleteFeed()
    const { isAdmin } = useUserRole()

    console.log(isAdmin)

    const handleAdminDelete = () => {
        // Delete immediately without confirmation
        if (feed.id) {
            adminDeleteFeed.mutate({ feedId: feed.id })
        }
    }

    // Dropdown menu for additional actions
    const dropdownActions = (showPreviewButton ||
        showSimilarButton ||
        isAdmin) && (
            <>
                {/* Desktop version */}
                <div className="hidden md:block">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                            >
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                <span className="sr-only">More options</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {showPreviewButton && (
                                <Link href={`/feeds/${feed.id}/articles`}>
                                    <DropdownMenuItem>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Preview
                                    </DropdownMenuItem>
                                </Link>
                            )}
                            {showSimilarButton && (
                                <Link href={`/feeds/${feed.id}/similar`}>
                                    <DropdownMenuItem>
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        View Similar Feeds
                                    </DropdownMenuItem>
                                </Link>
                            )}
                            {isAdmin && (
                                <>
                                    <DropdownMenuItem
                                        onSelect={() => setIsEditDialogOpen(true)}
                                    >
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onSelect={handleAdminDelete}
                                        className="text-destructive focus:text-destructive"
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Mobile version - shown below description */}
                {/* Note: BaseFeedCard doesn't support mobile-specific positioning yet */}
            </>
        )

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
                content_type: (feed.content_type as any) ?? null,
                tags_native: feed.tags_native ?? [],
            }

    return (
        <>
            <BaseFeedCard
                feed={normalizedFeed}
                variant="default"
                className={className}
                headerActions={dropdownActions}
                showFollowButton={showFollowButton}
            />

            {/* Edit Feed Dialog */}
            <EditFeedDialog
                feed={feed as FeedSummary}
                isOpen={isEditDialogOpen}
                onClose={() => setIsEditDialogOpen(false)}
            />
        </>
    )
}
