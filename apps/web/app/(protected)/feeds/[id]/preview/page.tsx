import { ArticlesSuspenseWrapper } from "@/components/articles/ArticlesSuspenseWrapper"
import "@/lib/configure-api-client"
import { ApiClient } from "@readspace/shared"

// Force dynamic rendering to ensure fresh data for previews
export const dynamic = "force-dynamic"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function FeedPreviewPage({ params }: PageProps) {
    const { id: feedId } = await params

    // Refresh the feed first in SSR to get latest articles for preview
    try {
        console.log(`Refreshing feed ${feedId} in preview mode...`)
        await ApiClient.rss.refreshFeed(feedId, true, true)
        console.log(`Feed ${feedId} refreshed successfully`)
    } catch (error) {
        console.error("Failed to refresh feed in preview mode:", error)
        // Continue rendering even if refresh fails
    }

    return <ArticlesSuspenseWrapper showUnreadBadge={false} feedId={feedId} />
}
