import { Suspense } from "react"
import { ArticlesView } from "@/components/articles"
import { ArticlesViewSkeleton } from "./articles-view-skeleton"
import { ArticlesEmptyState } from "./articles-empty-state"

interface ArticlesSuspenseWrapperProps {
    title?: string
    showUnreadBadge?: boolean
    initialSidebarTitle?: string
    feedId?: string
    folderId?: string
    libraryId?: string
    publishedSince?: string
    publishedUntil?: string
    mode?: "allArticles" | "recentlyRead" | "readLater" | "today"
    userTimezone?: string
    onCreateFolder?: () => void
    onAddFeed?: (folderId?: string) => void
}

export function ArticlesSuspenseWrapper(props: ArticlesSuspenseWrapperProps) {
    const { title, showUnreadBadge, onCreateFolder, onAddFeed, ...articlesViewProps } = props
    
    return (
        <Suspense 
            fallback={
                <ArticlesViewSkeleton 
                    title={title || articlesViewProps.initialSidebarTitle || "Loading..."}
                    showUnreadBadge={showUnreadBadge}
                />
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