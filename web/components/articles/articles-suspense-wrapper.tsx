import { Suspense } from "react"
import { ArticlesView } from "@/components/articles"
import { ArticlesViewSkeleton } from "./articles-view-skeleton"

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
}

export function ArticlesSuspenseWrapper(props: ArticlesSuspenseWrapperProps) {
    const { title, showUnreadBadge, ...articlesViewProps } = props
    
    return (
        <Suspense 
            fallback={
                <ArticlesViewSkeleton 
                    title={title || articlesViewProps.initialSidebarTitle || "Loading..."}
                    showUnreadBadge={showUnreadBadge}
                />
            }
        >
            <ArticlesView {...articlesViewProps} />
        </Suspense>
    )
}