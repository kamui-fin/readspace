"use client"

import { useQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"

import { FeedCard } from "@/components/feeds/FeedCard"
import { FeedCardSkeleton } from "@/components/feeds/FeedCardSkeleton"
import { FEEDS_INDEX_NAME, meilisearchClient } from "@/lib/meilisearch-client"
import {
    feedDiscoveryResultToFeed,
    type FeedDiscoveryResult,
} from "@readspace/shared"

interface SimilarFeedsClientProps {
    feedId: string
}

interface Feed {
    title?: string | null
    url?: string
    image_url?: string | null
}

interface MeilisearchHit {
    id: string
    url: string
    title: string
    description?: string | null
    link?: string | null
    language?: string | null
    image_url?: string | null
    tags?: string[]
    top_level_category?: string | null
    popularity_score?: number | null
    _rankingScore?: number
}

function PageHeader() {
    return (
        <div className="mt-8 mb-12 flex items-center gap-3 justify-center w-full">
            <h1 className="tracking-tight text-4xl font-semibold text-foreground">
                You may also like
            </h1>
        </div>
    )
}

interface PageLayoutProps {
    children: ReactNode
}

function PageLayout({ children }: PageLayoutProps) {
    return (
        <div className="flex flex-col min-h-screen">
            <main className="flex-1 px-4 py-4 md:px-6 md:py-6">
                <div className="max-w-full md:max-w-4xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    )
}

function convertHitToFeed(hit: MeilisearchHit) {
    const discoveryResult: FeedDiscoveryResult = {
        id: hit.id,
        url: hit.url,
        title: hit.title,
        description: hit.description ?? null,
        link: hit.link ?? null,
        language: hit.language ?? null,
        image_url: hit.image_url ?? null,
        tags: hit.tags || [],
        category: hit.top_level_category ?? null,
        popularity_score: hit.popularity_score ?? 0,
        relevance: hit._rankingScore || 0,
        search_metadata: undefined,
        is_preview: false,
        preview_url: undefined,
        is_subscribed: false,
    }
    return feedDiscoveryResultToFeed(discoveryResult)
}

interface ErrorMessageProps {
    error: Error
}

function ErrorMessage({ error }: ErrorMessageProps) {
    const isNotFound =
        error.message?.includes("404") || error.message?.includes("not found")

    return (
        <div className="flex flex-col items-center justify-center py-16">
            <h3 className="text-lg font-medium mb-2 text-foreground">
                {isNotFound ? "Feed not found" : "Error loading similar feeds"}
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
                {isNotFound
                    ? "The requested feed could not be found."
                    : error.message || "Please try again later."}
            </p>
        </div>
    )
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-16">
            <h3 className="text-lg font-medium mb-2 text-foreground">
                No similar feeds found
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
                This feed might be unique, or similar feeds may not have
                embeddings yet.
            </p>
        </div>
    )
}

export default function SimilarFeedsClient({
    feedId,
}: SimilarFeedsClientProps) {
    // Query for similar feeds using Meilisearch
    const {
        data: similarResults,
        error: similarError,
        isLoading: isLoadingSimilar,
    } = useQuery({
        queryKey: ["similarFeeds", feedId],
        queryFn: async () => {
            const index = meilisearchClient.index(FEEDS_INDEX_NAME)
            const results = await index.searchSimilarDocuments({
                id: feedId,
                limit: 50,
                embedder: "default",
                showRankingScore: true,
            })
            return results
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 2,
        enabled: !!feedId,
    })

    const similarFeeds = similarResults?.hits || []

    const renderContent = () => {
        if (isLoadingSimilar) {
            return (
                <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <FeedCardSkeleton key={index} />
                    ))}
                </div>
            )
        }

        if (similarError) {
            return <ErrorMessage error={similarError as Error} />
        }

        if (similarFeeds.length === 0) {
            return <EmptyState />
        }

        return (
            <div className="flex flex-col divide-y divide-border/40">
                {(similarFeeds as MeilisearchHit[]).map((hit) => (
                    <FeedCard
                        key={hit.id}
                        feed={convertHitToFeed(hit)}
                        showSimilarButton={true}
                        showPreviewButton={true}
                        showFollowButton={true}
                        className="py-8"
                    />
                ))}
            </div>
        )
    }

    return (
        <PageLayout>
            <PageHeader />
            {renderContent()}
        </PageLayout>
    )
}
