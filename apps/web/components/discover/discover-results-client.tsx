"use client"

import { FeedCard } from "@/components/feeds/FeedCard"
import { FeedPreviewCard } from "@/components/feeds/FeedPreviewCard"
import {
    feedDiscoveryResultToFeed,
    type FeedDiscoveryResult,
} from "@readspace/shared"

interface DiscoverResultsClientProps {
    searchData: {
        results: FeedDiscoveryResult[]
        total_count: number
    }
}

export function DiscoverResultsClient({
    searchData,
}: DiscoverResultsClientProps) {
    return (
        <div>
            {/* Results Count */}
            <div className="flex items-center justify-between mb-6">
                <div className="text-[#91998C] dark:text-muted-foreground text-sm font-medium">
                    {searchData.total_count} results
                </div>
            </div>

            <div className="space-y-4">
                {searchData.results.map((discoveryResult) => {
                    const feed = feedDiscoveryResultToFeed(discoveryResult)
                    return (
                        <div key={feed.id}>
                            {feed.is_preview && feed.preview_url ? (
                                <FeedPreviewCard
                                    feed={{
                                        ...feed,
                                        is_preview: true,
                                        preview_url: feed.preview_url,
                                    }}
                                />
                            ) : (
                                <FeedCard feed={feed} />
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
