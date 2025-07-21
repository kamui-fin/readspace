"use client"

import { ArticlesView } from "@/components/articles"
import { useFeed } from "@/lib/api/hooks/feeds"
import { useParams } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2 } from "lucide-react"

export default function FeedArticlesPage() {
    const params = useParams()
    const feedId = params.id as string
    const { data: feed, isLoading } = useFeed(feedId)

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-1rem)] w-full bg-background rounded-xl shadow-sm">
                <div className="w-full flex flex-col items-center justify-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-muted-foreground">Loading feed...</p>
                </div>
            </div>
        )
    }

    if (!feed) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                    <p className="text-lg font-medium">Feed not found</p>
                    <p className="text-muted-foreground">
                        The feed you're looking for doesn't exist or has been
                        removed.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <ArticlesView
            feedId={feedId}
            initialSidebarTitle={feed.title || "Unknown Feed"}
        />
    )
}
