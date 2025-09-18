import { Suspense } from "react"
import { ArticlesView } from "@/components/articles"
import { ArticlesViewSkeleton } from "./ArticlesViewSkeleton"

interface ArticlesSuspenseWrapperProps {
    showUnreadBadge?: boolean
    initialSidebarTitle?: string
    feedId?: string
    folderId?: string
    libraryId?: string
    publishedSince?: string
    publishedUntil?: string
    mode?: "allArticles" | "recentlyRead" | "readLater" | "today"
    onCreateFolder?: () => void
    onAddFeed?: (folderId?: string) => void
}

export function ArticlesSuspenseWrapper(props: ArticlesSuspenseWrapperProps) {
    const { showUnreadBadge, onCreateFolder, onAddFeed, ...articlesViewProps } =
        props

    return (
        <Suspense
            fallback={
                <ArticlesViewSkeleton showUnreadBadge={showUnreadBadge} />
            }
        >
            <ArticlesView
                {...articlesViewProps}
                onCreateFolder={onCreateFolder}
                onAddFeed={onAddFeed}
            />
        </Suspense>
    )
}
