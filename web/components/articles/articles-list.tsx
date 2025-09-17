"use client"

import { useEffect, useRef } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import type { Article } from "@readspace/shared"
import { ArticleItem } from "./article-item"
import { ArticlesViewSkeleton } from "./articles-view-skeleton"
import { ArticlesEmptyState } from "./articles-empty-state"

interface ArticlesListProps {
    /** Array of articles to display */
    articles: Article[]
    /** Currently selected article ID */
    selectedArticleId: string | null
    /** Whether articles are currently loading */
    isLoading: boolean
    /** Whether more articles are being fetched */
    isFetching: boolean
    /** Whether there are more articles to load */
    hasNextPage: boolean | undefined
    /** Whether to show only unread articles */
    showUnreadOnly: boolean
    /** Whether in recently read mode */
    isRecentlyReadMode?: boolean
    /** Whether in read later mode */
    isReadLaterMode?: boolean
    /** Sidebar title for the current view */
    sidebarTitle?: string
    /** Feed ID for empty state */
    feedId?: string
    /** Folder ID for empty state */
    folderId?: string
    /** Function to fetch next page of articles */
    onLoadMore: () => void
    /** Function called when an article is selected */
    onArticleSelect: (articleId: string) => void
}

/**
 * ArticlesList component handles the rendering and infinite scroll behavior
 * for the articles list view.
 */
export function ArticlesList({
    articles,
    selectedArticleId,
    isLoading,
    isFetching,
    hasNextPage,
    showUnreadOnly,
    isRecentlyReadMode = false,
    isReadLaterMode = false,
    feedId,
    folderId,
    onLoadMore,
    onArticleSelect,
}: ArticlesListProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const loadMoreRef = useRef<HTMLDivElement>(null)
    const isMobile = useIsMobile()

    // Filter articles based on unread toggle
    const filteredArticles = showUnreadOnly
        ? articles.filter((article) => !article.is_read)
        : articles

    // Infinite scroll implementation
    useEffect(() => {
        if (!hasNextPage || isFetching || !loadMoreRef.current) return

        const observer = new IntersectionObserver(
            (entries) => {
                const target = entries[0]
                if (target.isIntersecting) {
                    onLoadMore()
                }
            },
            {
                root: scrollContainerRef.current,
                rootMargin: "100px", // Load more when 100px from bottom
                threshold: 0.1,
            }
        )

        observer.observe(loadMoreRef.current)

        return () => observer.disconnect()
    }, [hasNextPage, isFetching, onLoadMore])

    // Auto-select first article on desktop when none selected
    useEffect(() => {
        if (!isMobile && !selectedArticleId && filteredArticles.length > 0) {
            onArticleSelect(filteredArticles[0].id)
        }
    }, [filteredArticles, selectedArticleId, isMobile, onArticleSelect])

    // Show loading skeleton while initial load
    if (isLoading) {
        return <ArticlesViewSkeleton />
    }

    // Show empty state when no articles
    if (filteredArticles.length === 0) {
        return (
            <ArticlesEmptyState
                mode={
                    isRecentlyReadMode
                        ? "recentlyRead"
                        : isReadLaterMode
                          ? "readLater"
                          : "allArticles"
                }
                feedId={feedId}
                folderId={folderId}
            />
        )
    }

    return (
        <div
            ref={scrollContainerRef}
            className="flex-1 overflow-auto scroll-smooth"
            style={{ scrollbarGutter: "stable" }}
        >
            <div className="space-y-0">
                {filteredArticles.map((article, index) => (
                    <ArticleItem
                        key={article.id}
                        article={article}
                        isActive={selectedArticleId === article.id}
                        isLastInGroup={index === filteredArticles.length - 1}
                        isRecentlyReadMode={isRecentlyReadMode}
                        onClick={() => onArticleSelect(article.id)}
                    />
                ))}

                {/* Load more trigger */}
                {hasNextPage && (
                    <div ref={loadMoreRef} className="flex justify-center py-4">
                        {isFetching ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Loading more articles...
                            </div>
                        ) : (
                            <div className="text-xs text-muted-foreground">
                                Scroll to load more
                            </div>
                        )}
                    </div>
                )}

                {/* End indicator */}
                {!hasNextPage && filteredArticles.length > 0 && (
                    <div className="py-8 text-center">
                        <p className="text-xs text-muted-foreground">
                            You&apos;ve reached the end of the articles
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
