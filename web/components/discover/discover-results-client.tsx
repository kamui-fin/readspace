"use client"

import { FeedCard } from "@/components/feeds/FeedCard"
import { FeedPreviewCard } from "@/components/feeds/FeedPreviewCard"

interface DiscoverResultsClientProps {
    searchData: {
        results: any[]
        total_count: number
    }
}

export function DiscoverResultsClient({ searchData }: DiscoverResultsClientProps) {
    return (
        <div>
            {/* Results Count */}
            <div className="flex items-center justify-between mb-6">
                <div className="text-[#91998C] dark:text-muted-foreground text-sm font-medium">
                    {searchData.total_count} results
                </div>
            </div>

            <div className="space-y-4">
                {searchData.results.map((feed: any) => (
                    <div key={feed.id}>
                        {feed.is_preview ? (
                            <FeedPreviewCard feed={feed} />
                        ) : (
                            <FeedCard feed={feed} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}