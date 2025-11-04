"use client"

import { ArticlesView } from "@/components/articles"
import { useParams } from "next/navigation"

export default function FolderArticlesPage() {
    const params = useParams()
    const folderId = params.id as string

    return (
        <ArticlesView folderId={folderId} />
    )
}
