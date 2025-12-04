"use client"

import { useMemo } from "react"
import { useInfiniteArticles } from "@readspace/shared"
import { ArticlesView } from "@/components/features/articles/ArticlesView"
import type { Article } from "@readspace/shared"

interface ArticlesPageClientProps {
    defaultLayout?: number[]
}

export function ArticlesPageClient({ defaultLayout }: ArticlesPageClientProps) {
    const query = useInfiniteArticles(
        {
            limit: 25,
        },
        {
            staleTime: 5 * 60 * 1000, // 5 minutes
        }
    )

    const articles = useMemo(() => {
        if (!query.data?.pages) return []
        return query.data.pages.flatMap(
            (page: { items: unknown[] }) => page.items
        ) as Article[]
    }, [query.data])

    return (
        <ArticlesView
            initialSidebarTitle="All Articles"
            defaultLayout={defaultLayout}
            articles={articles}
            query={query}
        />
    )
}
