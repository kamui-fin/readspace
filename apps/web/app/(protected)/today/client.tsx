"use client"

import { useMemo } from "react"
import { useInfiniteTodayArticles, ArticleFilterMode } from "@readspace/shared"
import { ArticlesView } from "@/components/features/articles/ArticlesView"
import type { Article } from "@readspace/shared"

interface TodayPageClientProps {
    defaultLayout?: number[]
}

export function TodayPageClient({ defaultLayout }: TodayPageClientProps) {
    const query = useInfiniteTodayArticles({
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
            initialSidebarTitle="Today"
            mode={ArticleFilterMode.Today}
            defaultLayout={defaultLayout}
            articles={articles}
            query={query}
        />
    )
}
