import { BaseFeedCard } from "./BaseFeedCard"
import { type FeedSummary } from "@readspace/shared"

interface FeedPreviewCardProps {
    feed: FeedSummary & {
        is_preview: true
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
