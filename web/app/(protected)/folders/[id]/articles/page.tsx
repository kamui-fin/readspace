"use client"

import { ArticlesView } from "@/components/articles"
import { useFolders } from "@/lib/api/hooks/feeds"
import { useParams } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function FolderArticlesPage() {
    const params = useParams()
    const folderId = params.id as string
    const { data: folders = [], isLoading } = useFolders()

    const folder = folders.find((f) => f.id === folderId)

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-1rem)] w-full bg-background rounded-xl shadow-sm">
                <div className="w-full flex flex-col items-center justify-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-muted-foreground">Loading folder...</p>
                </div>
            </div>
        )
    }

    if (!folder) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                    <p className="text-lg font-medium">Folder not found</p>
                    <p className="text-muted-foreground">
                        The folder you're looking for doesn't exist or has been
                        removed.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <ArticlesView
            folderId={folderId}
            initialSidebarTitle={folder.name || "Unknown Folder"}
        />
    )
}
