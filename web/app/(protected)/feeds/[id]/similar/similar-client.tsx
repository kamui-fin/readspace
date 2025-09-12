"use client"

import { useQuery } from "@tanstack/react-query"
import { Sparkles } from "lucide-react"

import Header from "@/components/navigation/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ApiClient } from "@/lib/api/client"
import { FeedCard } from "@/components/feeds/FeedCard"
import { FeedCardSkeleton } from "@/components/feeds/FeedCardSkeleton"

interface SimilarFeedsClientProps {
    feedId: string
}

interface SimilarFeed {
    id: string
    title: string | null
    description: string | null
    url: string
    link: string | null
    image_url: string | null
    tags: string[]
    language: string | null
    category: string | null
    popularity_score: number
    relevance: number
    search_metadata?: Record<string, any>
}

export default function SimilarFeedsClient({
    feedId
}: SimilarFeedsClientProps) {

    // Query for similar feeds data (includes source feed)
    const { data: similarData, isLoading, error } = useQuery({
        queryKey: ['similarFeeds', feedId],
        queryFn: () => ApiClient.rss.getSimilarFeeds(feedId, { limit: 10 }),
        staleTime: 5 * 60 * 1000, // 5 minutes
    })

    const sourceFeed = similarData?.source_feed
    const similarFeeds = similarData?.similar_feeds || []


    if (error) {
        return (
            <div className="min-h-screen bg-white">
                <Header breadcrumbItems={[
                    { label: "Discover", href: "/discover" }
                ]} />

                <div className="max-w-4xl mx-auto px-6 py-8">
                    <div className="mb-8">

                        <div className="text-center space-y-4">
                            <div className="flex items-center justify-center gap-2 mb-4">
                                <Sparkles className="h-8 w-8 text-primary" />
                                <h1 className="text-3xl font-bold">Similar Feeds</h1>
                            </div>
                            
                            <div className="bg-muted/50 rounded-lg p-4 max-w-2xl mx-auto">
                                <p className="text-muted-foreground mb-2">
                                    Feeds similar to:
                                </p>
                                <div className="flex items-center justify-center gap-3">
                                    {sourceFeed?.image_url && (
                                        <img 
                                            src={sourceFeed.image_url} 
                                            alt="" 
                                            className="w-6 h-6 rounded"
                                            onError={(e) => { e.currentTarget.style.display = 'none' }}
                                        />
                                    )}
                                    <h2 className="font-semibold text-foreground">
                                        {sourceFeed?.title || sourceFeed?.url || 'Loading...'}
                                    </h2>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Card className="p-8 text-center border-dashed border-destructive">
                        <div className="text-destructive">
                            <Sparkles className="h-16 w-16 mx-auto mb-4 opacity-30" />
                            <h3 className="text-xl font-medium mb-3">Error loading similar feeds</h3>
                            <p className="text-base">{error.message || "Please try again later."}</p>
                        </div>
                    </Card>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-white">
            <Header breadcrumbItems={[
                { label: "Discover", href: "/discover" }
            ]} />
            
            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* Header Section */}
                <div className="mb-8">

                    <div className="text-center space-y-4">
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <Sparkles className="h-8 w-8 text-primary" />
                            <h1 className="text-3xl font-bold">Similar Feeds</h1>
                        </div>
                        
                        <div className="bg-muted/50 rounded-lg p-4 max-w-2xl mx-auto">
                            <p className="text-muted-foreground mb-2">
                                Feeds similar to:
                            </p>
                            <div className="flex items-center justify-center gap-3">
                                {sourceFeed?.image_url && (
                                    <img 
                                        src={sourceFeed.image_url} 
                                        alt="" 
                                        className="w-6 h-6 rounded"
                                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                                    />
                                )}
                                <h2 className="font-semibold text-foreground">
                                    {sourceFeed?.title || sourceFeed?.url || 'Loading...'}
                                </h2>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Similar Feeds Content */}
                <div>
                    {isLoading ? (
                        <div className="space-y-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <FeedCardSkeleton key={i} />
                            ))}
                        </div>
                    ) : similarFeeds && similarFeeds.length > 0 ? (
                        <div className="space-y-4">
                            {similarFeeds.map((feed) => (
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
                        <Card className="p-12 text-center border-dashed">
                            <div className="text-muted-foreground">
                                <Sparkles className="h-16 w-16 mx-auto mb-6 opacity-30" />
                                <h3 className="text-xl font-medium mb-3">No similar feeds found</h3>
                                <p className="text-base">
                                    This feed might be unique, or similar feeds may not have embeddings yet.
                                </p>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}

