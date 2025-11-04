"use client"

import { ArticlesView } from "@/components/articles"
import { use } from "react"

interface PageProps {
    params: Promise<{ id: string }>
}

export default function FeedArticlesPage({ params }: PageProps) {
    const { id: feedId } = use(params)

    return <ArticlesView feedId={feedId} />
}
