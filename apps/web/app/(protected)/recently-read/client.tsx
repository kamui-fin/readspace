"use client"

import { useMemo } from "react"
import {
    useInfiniteRecentlyReadArticles,
    ArticleFilterMode,
} from "@readspace/shared"
import { ArticlesView } from "@/components/features/articles/ArticlesView"
import type { Article } from "@readspace/shared"

interface RecentlyReadPageClientProps {
    defaultLayout?: number[]
}

export function RecentlyReadPageClient({
    defaultLayout,
}: RecentlyReadPageClientProps) {
    const query = useInfiniteRecentlyReadArticles({
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
            initialSidebarTitle="Recently Read"
            mode={ArticleFilterMode.RecentlyRead}
            defaultLayout={defaultLayout}
            articles={articles}
            query={query}
        />
    )
}
