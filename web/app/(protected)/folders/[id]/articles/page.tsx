'use client'

import ArticlesPage from '@/app/(protected)/articles/page'
import { useFolders } from '@/lib/api/hooks/feeds'
import { useParams } from 'next/navigation'

export default function FolderArticlesPage() {
    const params = useParams()
    const folderId = params.id as string
    const { data: folders = [], isLoading } = useFolders()

    const folder = folders.find(f => f.id === folderId)

    if (isLoading) {
        return <div className="flex h-full w-full items-center justify-center">Loading folder...</div>
    }

    if (!folder) {
        return <div className="flex h-full w-full items-center justify-center">Folder not found</div>
    }

    return (
        <ArticlesPage
            initialSidebarTitle={folder.name || 'Folder Articles'}
            folderId={folderId}
        />
    )
} 