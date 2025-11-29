import { BaseFeedCard } from "@/components/feeds/BaseFeedCard"
import { type FeedSummary } from "@readspace/shared"

interface FeedPreviewCardProps {
    feed: FeedSummary & {
        is_preview: true
        preview_url: string
    }
}

/**
 * Feed Preview Card Component
 *
 * Displays a preview of an RSS feed with a dashed border and primary background.
 * Uses BaseFeedCard with the "preview" variant and no additional actions.
 */
export function FeedPreviewCard({ feed }: FeedPreviewCardProps) {
    return (
        <BaseFeedCard feed={feed} variant="preview" showFollowButton={true} />
    )
}
