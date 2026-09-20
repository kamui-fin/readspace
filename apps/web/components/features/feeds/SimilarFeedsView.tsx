"use client"

import NextImage from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { DiscoverLayout } from "@/components/features/discover/DiscoverLayout"
import { FeedCard } from "@/components/features/feeds/FeedCard"
import { FeedCardSkeleton } from "@/components/features/feeds/FeedCardSkeleton"
import { Button } from "@/components/ui/button"
import { useSimilarFeeds } from "@/components/features/discover/hooks/use-similar-feeds"

interface SimilarFeedsViewProps {
    feedId: string
    initialTitle?: string
}

export default function SimilarFeedsView({
    feedId,
    initialTitle,
}: SimilarFeedsViewProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const titleParam = searchParams?.get("title") || initialTitle
    const { similarFeeds, anchorFeed, error, isLoading } =
        useSimilarFeeds(feedId)

    const displayTitle = titleParam || anchorFeed?.title || "this publication"
    const isNotFound =
        error?.message?.includes("404") || error?.message?.includes("not found")

    return (
        <DiscoverLayout>
            <div className="w-full mx-auto max-w-3xl pt-3 md:pt-6 pb-20">
                {/* Back Navigation */}
                <div className="mb-4">
                    <Link
                        href="/discover"
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group cursor-pointer"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" />
                        <span>Back to Discover</span>
                    </Link>
                </div>

                {/* Centered Header */}
                <div className="flex flex-col items-center mb-6">
                    <h1 className="text-2xl md:text-3xl font-semibold text-foreground dark:text-foreground tracking-tight text-center">
                        Feeds similar to{" "}
                        <span className="text-[#6A994E] dark:text-primary">
                            {displayTitle}
                        </span>
                    </h1>
                </div>

                {/* Results Count Header */}
                <div className="flex items-center justify-between mb-3 px-0.5 min-h-[28px]">
                    {isLoading ? (
                        <div className="h-4 w-24 bg-muted/60 dark:bg-muted/40 animate-pulse rounded" />
                    ) : (
                        <div className="text-xs md:text-sm font-medium text-muted-foreground">
                            {similarFeeds.length.toLocaleString()}{" "}
                            {similarFeeds.length === 1 ? "feed" : "feeds"} found
                        </div>
                    )}
                </div>

                {/* Main Content */}
                {isLoading ? (
                    <div className="flex flex-col divide-y divide-border/40">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <FeedCardSkeleton key={i} />
                        ))}
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <h3 className="text-xl font-medium mb-3 text-foreground dark:text-foreground">
                            {isNotFound
                                ? "Feed not found"
                                : "Something went wrong"}
                        </h3>
                        <p className="text-muted-foreground text-center max-w-md mb-6">
                            {isNotFound
                                ? "The requested feed could not be found."
                                : error.message ||
                                  "We couldn't load similar feeds. Please try again."}
                        </p>
                        <Button variant="outline" asChild>
                            <Link href="/discover">Back to Discover</Link>
                        </Button>
                    </div>
                ) : similarFeeds.length === 0 ? (
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
                            No similar feeds found
                        </h3>
                        <p className="text-muted-foreground text-center max-w-md mb-6">
                            This feed might be unique, or similar feeds may not
                            have embeddings yet.
                        </p>
                        <Button variant="outline" asChild>
                            <Link href="/discover">Browse Discover</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col divide-y divide-border/40">
                        {similarFeeds.map((feed) => (
                            <FeedCard
                                key={feed.id}
                                feed={feed}
                                className="py-4 md:py-5"
                                showSimilarButton={true}
                                showFollowButton={true}
                                onTagClick={(tag) => {
                                    router.push(
                                        `/discover?q=${encodeURIComponent(tag)}`
                                    )
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </DiscoverLayout>
    )
}
