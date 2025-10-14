"use client"

import { ArticlesSuspenseWrapper } from "@/components/articles/ArticlesSuspenseWrapper"
import { useParams, useSearchParams } from "next/navigation"

export default function FeedArticlesPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const feedId = params.id as string
    const isPreview = searchParams.get("preview") === "true"

    return (
        <ArticlesSuspenseWrapper
            showUnreadBadge={!isPreview}
            feedId={feedId}
        />
    )
}
