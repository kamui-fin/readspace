"use client"

import { useMemo } from "react"
import { useInfiniteArticles } from "@readspace/shared"
import { ArticlesView } from "@/components/features/articles/ArticlesView"
import type { Article } from "@readspace/shared"

interface FolderArticlesPageClientProps {
    folderId: string
    defaultLayout?: number[]
}

export function FolderArticlesPageClient({ folderId, defaultLayout }: FolderArticlesPageClientProps) {
    const query = useInfiniteArticles(
        {
            folderId,
            limit: 25,
        },
        {
            staleTime: 5 * 60 * 1000, // 5 minutes
        }
    )

    const articles = useMemo(() => {
        if (!query.data?.pages) return []
        return query.data.pages.flatMap((page: any) => page.items) as Article[]
    }, [query.data])

    return (
        <ArticlesView
            folderId={folderId}
            defaultLayout={defaultLayout}
            articles={articles}
            query={query}
        />
    )
}
