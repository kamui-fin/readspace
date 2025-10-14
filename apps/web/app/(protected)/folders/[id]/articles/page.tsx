"use client"

import { ArticlesSuspenseWrapper } from "@/components/articles/ArticlesSuspenseWrapper"
import { useParams } from "next/navigation"

export default function FolderArticlesPage() {
    const params = useParams()
    const folderId = params.id as string

    return (
        <ArticlesSuspenseWrapper
            showUnreadBadge={true}
            folderId={folderId}
        />
    )
}
