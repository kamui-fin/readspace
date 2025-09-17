"use client"

import { useQuery } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import NextImage from "next/image"

import { ApiClient, feedDiscoveryResultToFeed } from "@readspace/shared"
import { FeedCard } from "@/components/feeds/FeedCard"
import { FeedPreviewCard } from "@/components/feeds/FeedPreviewCard"
import { FeedCardSkeleton } from "@/components/feeds/FeedCardSkeleton"
import type { FeedDiscoveryResult } from "@readspace/shared"

interface DiscoverResultsProps {
    query?: string
    category?: string
    language?: string
}

export function DiscoverResults({
    query,
    category,
    language = "en",
}: DiscoverResultsProps) {
    const hasSearchParams = Boolean(query || category)

    // Get search results using React Query
    const {
        data: searchData,
        isLoading,
        isFetching,
        error: searchError,
    } = useQuery({
        queryKey: ["discover", "search", { q: query, category, language }],
        queryFn: async () => {
            try {
                return await ApiClient.rss.searchFeeds({
                    q: query,
                    category,
                    language,
                    limit: 50,
                })
            } catch (error) {
                toast.error("Failed to search feeds. Please try again.")
                throw error
            }
        },
        enabled: hasSearchParams,
        retry: (failureCount, error) => {
            // Only retry on network errors, not API errors
            return failureCount < 2 && !error?.message?.includes("400")
        },
    })

    if (!hasSearchParams) {
        return null
    }

    if (isLoading || isFetching) {
        return (
            <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <FeedCardSkeleton key={i} />
                ))}
            </div>
        )
    }

    if (searchError || searchData?.results.length === 0) {
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
                    {searchError ? "Search failed" : "No matching feeds found"}
                </h3>
                <p className="text-gray-500 dark:text-muted-foreground text-center max-w-md">
                    {searchError
                        ? "Please try again later."
                        : "Try rephrasing your query."}
                </p>
            </div>
        )
    }

    return (
        <div>
            {/* Results Count */}
            {searchData && (
                <div className="flex items-center justify-between mb-6">
                    <div className="text-[#91998C] dark:text-muted-foreground text-sm font-medium">
                        {searchData.total_count} results
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {searchData?.results.map(
                    (discoveryResult: FeedDiscoveryResult) => {
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
                                    <FeedCard feed={discoveryResult} />
                                )}
                            </div>
                        )
                    }
                )}
            </div>
        </div>
    )
}
