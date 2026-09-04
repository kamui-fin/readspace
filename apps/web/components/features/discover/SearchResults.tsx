import NextImage from "next/image"
import {
    useInfiniteHits,
    useInstantSearch,
    useStats,
} from "react-instantsearch"

import { FeedCard } from "@/components/features/feeds/FeedCard"
import { FeedCardSkeleton } from "@/components/features/feeds/FeedCardSkeleton"
import { FeedPreviewCard } from "@/components/features/feeds/FeedPreviewCard"
import { Button } from "@/components/ui/button"
import {
    type FeedDiscoveryResult,
    type FeedSummary,
    type MeilisearchFeedDocument,
    FeedCategory,
    ContentType,
} from "@readspace/shared"

interface SearchResultsProps {
    /** Callback to clear all search filters and query */
    onClearSearch: () => void
    /** Preview feed data when URL is detected */
    previewFeed?: FeedDiscoveryResult | null
    /** Whether preview is loading */
    isPreviewLoading?: boolean
    /** Preview error message */
    previewError?: string | null
    /** Whether preview fetch failed */
    isPreviewError?: boolean
}

function createPreviewFeedData(
    previewFeed: FeedDiscoveryResult
): FeedSummary & { is_preview: true } {
    return {
        id: previewFeed.id ?? "",
        url: previewFeed.url ?? "",
        title: previewFeed.title,
        link: previewFeed.link ?? null,
        image_url: previewFeed.image_url ?? null,
        is_preview: true,
        is_subscribed: previewFeed.is_subscribed,
        language: previewFeed.language ?? "en",
        author: previewFeed.author ?? null,
        content_type: (previewFeed.content_type as ContentType) ?? null,
        tags_native: previewFeed.tags_native ?? [],
        description: previewFeed.description,
    }
}

/**
 * Search Results component - displays feed search results with pagination.
 *
 * Shows a "no results" state when search completes with no matches,
 * but waits for loading to complete to avoid flashing empty state.
 *
 * When a preview feed is provided (URL detected), displays the preview card instead.
 */

export function SearchResults({
    onClearSearch,
    previewFeed,
    isPreviewLoading,
    previewError,
}: SearchResultsProps) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { hits: items, showMore, isLastPage } = useInfiniteHits({} as any)
    const { nbHits } = useStats()
    const { status } = useInstantSearch()

    // Don't show "no results" while the search is still loading OR while preview is loading
    const isLoading =
        status === "loading" || status === "stalled" || isPreviewLoading

    // Prepare preview feed data if available
    let previewFeedData:
        | (FeedSummary & {
              is_preview: true
          })
        | null = null
    if (previewFeed && !isPreviewLoading && !previewError) {
        previewFeedData = createPreviewFeedData(previewFeed)
    }

    // Show skeleton while preview is loading
    if (isPreviewLoading) {
        return (
            <div className="mb-8">
                <div className="flex items-center justify-between mb-2 pl-5 pr-2">
                    <h3 className="text-sm font-medium text-muted-foreground">
                        Feed Preview
                    </h3>
                </div>
                <FeedCardSkeleton />
            </div>
        )
    }

    return (
        <>
            {/* Show preview feed at the top if available */}
            {previewFeedData && (
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2 pl-5 pr-2">
                        <h3 className="text-sm font-medium text-muted-foreground">
                            Feed Preview
                        </h3>
                    </div>
                    <FeedPreviewCard feed={previewFeedData} />
                </div>
            )}

            {/* Results Header - Show for both results and empty state (if not loading), but hide if showing preview */}
            {!previewFeedData && (
                <div className="flex items-center justify-between mb-2 pl-5 pr-2">
                    <div className="text-[#91998C] dark:text-muted-foreground text-sm">
                        {nbHits} {nbHits === 1 ? "result" : "results"}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearSearch}
                        className="h-8 px-3 text-sm text-[#91998C] hover:text-[#6A994E] hover:bg-[#F3F9EF] dark:text-muted-foreground dark:hover:text-primary dark:hover:bg-accent"
                    >
                        Clear
                    </Button>
                </div>
            )}

            {items.length === 0 && !isLoading && !previewFeedData ? (
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="mb-6">
                        <NextImage
                            src="/discover/Search.svg"
                            alt="No results found"
                            width={132}
                            height={128}
                            className="w-32 h-auto"
                        />
                    </div>
                    <h3 className="text-xl font-medium mb-3 text-foreground dark:text-foreground">
                        No matching feeds found
                    </h3>
                    <p className="text-muted-foreground text-center max-w-md">
                        Try rephrasing your query or browsing by category.
                    </p>
                </div>
            ) : (
                <>
                    <div className="flex flex-col divide-y divide-border/40">
                        {items.map((hit) => {
                            const hitData =
                                hit as unknown as MeilisearchFeedDocument

                            const feedSummary: FeedSummary = {
                                id: hitData.id,
                                url: hitData.url,
                                title: hitData.title || "Untitled",
                                description: hitData.description ?? null,
                                link: hitData.link ?? null,
                                language: hitData.language || "en",
                                image_url: hitData.image_url ?? null,
                                author: hitData.author ?? null,
                                content_type:
                                    (hitData.content_type as ContentType) ??
                                    null,
                                tags_native: hitData.tags_native ?? [],
                                top_level_category: hitData.top_level_category
                                    ? (hitData.top_level_category as FeedCategory)
                                    : null,
                                popularity_score: hitData.popularity_score,
                                frontend_rank_override:
                                    hitData.frontend_rank_override,
                                is_subscribed: false,
                            }

                            return (
                                <FeedCard
                                    key={hitData.id}
                                    feed={feedSummary}
                                    className="py-8"
                                />
                            )
                        })}
                    </div>

                    {/* Load More button */}
                    {!isLastPage && items.length > 0 && (
                        <div className="flex justify-center mt-8 mb-4">
                            <Button
                                variant="outline"
                                onClick={() => showMore()}
                                className="h-9 px-6 hover:bg-[#F3F9EF] dark:hover:bg-accent text-[#91998C] hover:text-[#6A994E] dark:hover:text-primary transition-colors cursor-pointer"
                            >
                                Load More
                            </Button>
                        </div>
                    )}
                </>
            )}
        </>
    )
}
