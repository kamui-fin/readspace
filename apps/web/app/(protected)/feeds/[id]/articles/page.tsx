"use client"

import { ArticlesView } from "@/components/features/articles/ArticlesView"
import { use } from "react"

interface PageProps {
    params: Promise<{ id: string }>
}

export default function FeedArticlesPage({ params }: PageProps) {
    const { id: feedId } = use(params)

    return <ArticlesView feedId={feedId} />
}
