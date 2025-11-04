"use client"

import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Sparkles } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"

import { FeedCard } from "@/components/feeds/FeedCard"
import { FeedCardSkeleton } from "@/components/feeds/FeedCardSkeleton"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    ApiClient,
    type FeedDiscoveryResult,
    type SimilarFeedsResponse,
} from "@readspace/shared"

interface SimilarFeedsClientProps {
    feedId: string
}

export default function SimilarFeedsClient({
    feedId,
}: SimilarFeedsClientProps) {
    const router = useRouter()

    // Query for similar feeds data (includes source feed)
    const { data: similarData, error, isLoading } = useQuery<SimilarFeedsResponse>({
        queryKey: ["similarFeeds", feedId],
        queryFn: () => ApiClient.rss.getSimilarFeeds(feedId, { limit: 10 }),
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 2,
    })

    const sourceFeed = similarData?.source_feed
    const similarFeeds = similarData?.similar_feeds || []

    const handleBack = () => {
        router.back()
    }

    if (isLoading) {
        return (
            <div className="flex flex-col min-h-screen">
                <main className="flex-1 px-4 py-4 md:px-6 md:py-6">
                    <div className="max-w-full md:max-w-4xl mx-auto">
                        {/* Back Button */}
                        <div className="mb-6">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-9 w-9 p-0 transition-all duration-200 hover:scale-110 hover:bg-muted/60"
                                            onClick={handleBack}
                                            title="Back to feed"
                                        >
                                            <ArrowLeft className="h-4 w-4 transition-transform duration-200 hover:-translate-x-1" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Back to feed</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        {/* Header Section */}
                        <div className="flex flex-col items-start md:items-center mb-8 md:mb-12">
                            <div className="mb-4 hidden md:block">
                                <Sparkles className="h-16 w-16 text-primary animate-pulse" />
                            </div>

                            {/* Mobile: Title */}
                            <div className="flex md:hidden items-center w-full max-w-2xl mb-6 gap-3">
                                <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                                <h1 className="text-3xl font-semibold text-black dark:text-foreground min-h-[2.5rem] flex items-center truncate break-words flex-1">
                                    Similar Feeds
                                </h1>
                            </div>

                            {/* Desktop: Title centered */}
                            <h1 className="hidden md:flex text-4xl font-semibold text-black dark:text-foreground mb-6 min-h-[3rem] items-center justify-center max-w-2xl truncate break-words">
                                Similar Feeds
                            </h1>

                            {/* Source Feed Info */}
                            <div className="bg-muted/50 rounded-lg p-4 max-w-2xl mx-auto w-full">
                                <p className="text-muted-foreground mb-2 text-center">
                                    Feeds similar to:
                                </p>
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-6 h-6 bg-muted rounded animate-pulse" />
                                    <div className="h-6 w-48 bg-muted rounded animate-pulse" />
                                </div>
                            </div>
                        </div>

                        {/* Similar Feeds Skeleton */}
                        <div className="space-y-4">
                            {Array.from({ length: 5 }).map((_, index) => (
                                <FeedCardSkeleton key={index} />
                            ))}
                        </div>
                    </div>
                </main>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col min-h-screen">
                <main className="flex-1 px-4 py-4 md:px-6 md:py-6">
                    <div className="max-w-full md:max-w-4xl mx-auto">
                        {/* Back Button */}
                        <div className="mb-6">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-9 w-9 p-0 transition-all duration-200 hover:scale-110 hover:bg-muted/60"
                                            onClick={handleBack}
                                            title="Back to feed"
                                        >
                                            <ArrowLeft className="h-4 w-4 transition-transform duration-200 hover:-translate-x-1" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Back to feed</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <div className="mb-8">
                            <div className="text-center space-y-4">
                                <div className="flex items-center justify-center gap-2 mb-4">
                                    <Sparkles className="h-8 w-8 text-primary" />
                                    <h1 className="text-3xl font-bold">
                                        Similar Feeds
                                    </h1>
                                </div>

                                <div className="bg-muted/50 rounded-lg p-4 max-w-2xl mx-auto">
                                    <p className="text-muted-foreground mb-2">
                                        Feeds similar to:
                                    </p>
                                    <div className="flex items-center justify-center gap-3">
                                        {sourceFeed?.image_url && (
                                            <Image
                                                src={sourceFeed.image_url}
                                                alt={
                                                    sourceFeed.title || "Feed image"
                                                }
                                                width={24}
                                                height={24}
                                                className="w-6 h-6 rounded"
                                            />
                                        )}
                                        <h2 className="font-semibold text-foreground">
                                            {sourceFeed?.title ||
                                                sourceFeed?.url ||
                                                "Loading..."}
                                        </h2>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center py-16">
                            <div className="mb-6">
                                <Sparkles className="h-16 w-16 text-destructive/30" />
                            </div>
                            <h3 className="text-xl font-medium mb-3 text-black dark:text-foreground">
                                {error.message?.includes("404") || error.message?.includes("not found")
                                    ? "Feed not found"
                                    : "Error loading similar feeds"}
                            </h3>
                            <p className="text-gray-500 dark:text-muted-foreground text-center max-w-md">
                                {error.message?.includes("404") || error.message?.includes("not found")
                                    ? "The requested feed could not be found."
                                    : error.message || "Please try again later."}
                            </p>
                        </div>
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className="flex flex-col min-h-screen">
            <main className="flex-1 px-4 py-4 md:px-6 md:py-6">
                <div className="max-w-full md:max-w-4xl mx-auto">
                    {/* Back Button */}
                    <div className="mb-6">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 w-9 p-0 transition-all duration-200 hover:scale-110 hover:bg-muted/60"
                                        onClick={handleBack}
                                        title="Back to feed"
                                    >
                                        <ArrowLeft className="h-4 w-4 transition-transform duration-200 hover:-translate-x-1" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Back to feed</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    {/* Header Section */}
                    <div className="flex flex-col items-start md:items-center mb-8 md:mb-12">
                        <div className="mb-4 hidden md:block">
                            <Sparkles className="h-16 w-16 text-primary" />
                        </div>

                        {/* Mobile: Title */}
                        <div className="flex md:hidden items-center w-full max-w-2xl mb-6 gap-3">
                            <Sparkles className="h-8 w-8 text-primary" />
                            <h1 className="text-3xl font-semibold text-black dark:text-foreground min-h-[2.5rem] flex items-center truncate break-words flex-1">
                                Similar Feeds
                            </h1>
                        </div>

                        {/* Desktop: Title centered */}
                        <h1 className="hidden md:flex text-4xl font-semibold text-black dark:text-foreground mb-6 min-h-[3rem] items-center justify-center max-w-2xl truncate break-words">
                            Similar Feeds
                        </h1>

                        {/* Source Feed Info */}
                        <div className="bg-muted/50 rounded-lg p-4 max-w-2xl mx-auto w-full">
                            <p className="text-muted-foreground mb-2 text-center">
                                Feeds similar to:
                            </p>
                            <div className="flex items-center justify-center gap-3">
                                {sourceFeed?.image_url && (
                                    <Image
                                        src={sourceFeed.image_url}
                                        alt={sourceFeed.title || "Feed image"}
                                        width={24}
                                        height={24}
                                        className="w-6 h-6 rounded"
                                    />
                                )}
                                <h2 className="font-semibold text-foreground">
                                    {sourceFeed?.title ||
                                        sourceFeed?.url ||
                                        "Loading..."}
                                </h2>
                            </div>
                        </div>
                    </div>

                    {/* Similar Feeds Content */}
                    <div>
                        {similarFeeds && similarFeeds.length > 0 ? (
                            <div className="space-y-4">
                                {similarFeeds.map((feed: FeedDiscoveryResult) => (
                                    <FeedCard
                                        key={feed.id}
                                        feed={feed}
                                        showSimilarButton={false}
                                        showPreviewButton={true}
                                        showFollowButton={true}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16">
                                <div className="mb-6">
                                    <Sparkles className="h-16 w-16 text-muted-foreground/30" />
                                </div>
                                <h3 className="text-xl font-medium mb-3 text-black dark:text-foreground">
                                    No similar feeds found
                                </h3>
                                <p className="text-gray-500 dark:text-muted-foreground text-center max-w-md">
                                    This feed might be unique, or similar feeds may not have embeddings yet.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}
