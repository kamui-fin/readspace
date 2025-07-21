"use client"

import { ArticlesView } from "@/components/articles"
import { useFeed } from "@/lib/api/hooks/feeds"
import { useParams } from "next/navigation"

export default function FeedArticlesPage() {
    const params = useParams()
    const feedId = params.id as string
    const { data: feed, isLoading } = useFeed(feedId)

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                Loading feed...
            </div>
        )
    }

    if (!feed) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                Feed not found
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
