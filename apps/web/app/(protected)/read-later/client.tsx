"use client"

import { useMemo } from "react"
import {
    useInfiniteReadLaterArticles,
    ArticleFilterMode,
} from "@readspace/shared"
import { ArticlesView } from "@/components/features/articles/ArticlesView"
import type { Article } from "@readspace/shared"

interface ReadLaterPageClientProps {
    defaultLayout?: number[]
}

export function ReadLaterPageClient({
    defaultLayout,
}: ReadLaterPageClientProps) {
    const query = useInfiniteReadLaterArticles({
        limit: 25,
    })

    const articles = useMemo(() => {
        if (!query.data?.pages) return []
        return query.data.pages.flatMap(
            (page: { items: unknown[] }) => page.items
        ) as Article[]
    }, [query.data])

    return (
        <ArticlesView
            initialSidebarTitle="Read Later"
            mode={ArticleFilterMode.ReadLater}
            defaultLayout={defaultLayout}
            articles={articles}
            query={query}
        />
    )
}
