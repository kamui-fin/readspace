import NextImage from "next/image"
import {
    useInfiniteHits,
    useInstantSearch,
    usePagination,
    useStats,
} from "react-instantsearch"

import { FeedCard } from "@/components/features/feeds/FeedCard"
import { FeedCardSkeleton } from "@/components/features/feeds/FeedCardSkeleton"
import { FeedPreviewCard } from "@/components/features/feeds/FeedPreviewCard"
import { Button } from "@/components/ui/button"
import {
    type FeedDiscoveryResult,
    type FeedSummary,
} from "@readspace/shared"

import { Pagination } from "./Pagination"

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
    isPreviewError,
}: SearchResultsProps) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { hits: items } = useInfiniteHits({} as any)
    const { nbHits } = useStats()
    const { currentRefinement, nbPages } = usePagination()
    const { status } = useInstantSearch()

    // Don't show "no results" while the search is still loading OR while preview is loading
    const isLoading =
        status === "loading" || status === "stalled" || isPreviewLoading

    // Prepare preview feed data if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let previewFeedData: any = null
    if (previewFeed && !isPreviewLoading && !previewError) {
        previewFeedData = {
            ...previewFeed,
            folder_id: "",
            folder_name: null,
            is_favorite: false,
            top_level_category: previewFeed.top_level_category,
            unread_count: 0,
            last_refreshed_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_preview: true,
            preview_url: previewFeed.link,
        }
    }

    // Show skeleton while preview is loading
    if (isPreviewLoading && items.length === 0) {
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

    if (items.length === 0 && !isLoading) {
        // If we have a preview feed, just show that without the "no results" message
        if (previewFeedData) {
            return (
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2 pl-5 pr-2">
                        <h3 className="text-sm font-medium text-muted-foreground">
                            Feed Preview
                        </h3>
                    </div>
                    <FeedPreviewCard feed={previewFeedData} />
                </div>
            )
        }

        // Only show "no results" if the preview has failed or there's no preview attempt
        if (isPreviewError || !isPreviewLoading) {
            return (
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
                    <h3 className="text-xl font-medium mb-3 text-black dark:text-foreground">
                        No matching feeds found
                    </h3>
                    <p className="text-gray-500 dark:text-muted-foreground text-center max-w-md">
                        Try rephrasing your query or browsing by category.
                    </p>
                </div>
            )
        }

        return null
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

            {/* Only show results header if we have actual results */}
            {items.length > 0 && (
                <div className="flex items-center justify-between mb-2 pl-5 pr-2">
                    <div className="text-[#91998C] dark:text-muted-foreground text-sm">
                        {nbHits} {nbHits === 1 ? "result" : "results"}
                        {nbPages > 1 && (
                            <span className="ml-2">
                                · Page {currentRefinement + 1} of {nbPages}
                            </span>
                        )}
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
            <div className="flex flex-col divide-y divide-border/40">
                {items.map((hit) => {
                    const hitData = hit as unknown as FeedDiscoveryResult
                    const discoveryResult: FeedDiscoveryResult = {
                        id: hitData.id || "",
                        url: hitData.url,
                        title: hitData.title,
                        description: hitData.description,
                        link: hitData.link,
                        language: hitData.language,
                        image_url: hitData.image_url,
                        tags: hitData.tags || [],
                        top_level_category: hitData.top_level_category,
                        popularity_score: hitData.popularity_score,
                    }

                    return (
                        <FeedCard
                            key={hitData.id}
                            feed={discoveryResult}
                            className="py-8"
                        />
                    )
                })}
            </div>

            {/* Pagination controls */}
            <Pagination />
        </>
    )
}
