import { BaseFeedCard } from "@/components/feeds/BaseFeedCard"
import { EditFeedDialog } from "@/components/feeds/EditFeedDialog"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUserRole } from "@/hooks/useUserRole"
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

    const handleAdminDelete = () => {
        // Delete immediately without confirmation
        adminDeleteFeed.mutate({ feedId: feed.id })
    }

    // Dropdown menu for additional actions
    const dropdownActions = (showPreviewButton || showSimilarButton) && (
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

    return (
        <>
            <BaseFeedCard
                feed={feed as any}
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
