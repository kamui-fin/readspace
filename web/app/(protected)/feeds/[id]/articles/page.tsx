'use client'

import ArticlesPage from '@/app/(protected)/articles/page'
import { useFeed } from '@/lib/api/hooks/feeds'
import { useParams } from 'next/navigation'

export default function FeedArticlesPage() {
    const params = useParams()
    const feedId = params.id as string
    const { data: feed, isLoading } = useFeed(feedId)

    if (isLoading) {
        return <div className="flex h-full w-full items-center justify-center">Loading feed...</div>
    }

    if (!feed) {
        return <div className="flex h-full w-full items-center justify-center">Feed not found</div>
    }

    return (
        <ArticlesPage
            sidebarTitle={feed.title || 'Feed Articles'}
            feedId={feedId}
        />
    )
} 