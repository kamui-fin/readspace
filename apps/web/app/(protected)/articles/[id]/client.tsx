"use client"

import { useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys, RSS_QUERY_KEYS, type Article } from "@readspace/shared"
import { StandaloneArticleReader } from "@/components/features/articles/StandaloneArticleReader"

interface ArticleReaderPageClientProps {
    articleId: string
}

/**
 * Pulls any article summary the list or Codex already cached so the reader paints instantly,
 * then hands off to `StandaloneArticleReader`, which fetches the full article.
 */
export function ArticleReaderPageClient({
    articleId,
}: ArticleReaderPageClientProps) {
    const queryClient = useQueryClient()

    const initialArticle = useMemo(() => {
        const cached = queryClient.getQueryData<Article>(
            queryKeys.article(articleId)
        )
        if (cached) return cached

        // Fall back to a summary sitting in any articles list (infinite or paged).
        for (const [, data] of queryClient.getQueriesData<{
            pages?: { items?: Article[] }[]
        }>({ queryKey: [RSS_QUERY_KEYS.ARTICLES] })) {
            const match = data?.pages
                ?.flatMap((page) => page.items ?? [])
                .find((item) => item.id === articleId)
            if (match) return match
        }
        return undefined
    }, [queryClient, articleId])

    return (
        <StandaloneArticleReader
            articleId={articleId}
            initialArticle={initialArticle}
        />
    )
}
