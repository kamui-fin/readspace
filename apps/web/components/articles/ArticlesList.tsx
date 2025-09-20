"use client"

import type { Article } from "@readspace/shared"
import { format, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { useEffect, useMemo, useRef } from "react"
import { ArticleItem } from "./ArticleItem"
import { ArticlesEmptyState } from "./ArticlesEmptyState"
import { ArticlesViewSkeleton } from "./ArticlesViewSkeleton"

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

    // Filter articles based on unread toggle
    const filteredArticles = showUnreadOnly
        ? articles.filter((article) => !article.is_read)
        : articles

    // Group articles by date for non-recently-read modes
    const groupedArticles = useMemo(() => {
        if (isRecentlyReadMode || filteredArticles.length === 0) {
            return {}
        }

        const groups: Record<string, { label: string; articles: Article[] }> =
            {}

        filteredArticles.forEach((article) => {
            if (!article.published_at) return

            const date = parseISO(article.published_at)
            const today = new Date()
            const yesterday = new Date()
            yesterday.setDate(today.getDate() - 1)

            let dateGroup: string
            let dateLabel: string

            if (date.toDateString() === today.toDateString()) {
                dateGroup = "today"
                dateLabel = "Today"
            } else if (date.toDateString() === yesterday.toDateString()) {
                dateGroup = "yesterday"
                dateLabel = "Yesterday"
            } else {
                dateGroup = format(date, "yyyy-MM-dd")
                dateLabel = format(date, "EEEE, MMMM d")
            }

            if (!groups[dateGroup]) {
                groups[dateGroup] = {
                    label: dateLabel,
                    articles: [],
                }
            }
            groups[dateGroup]?.articles.push(article)
        })

        return groups
    }, [filteredArticles, isRecentlyReadMode])

    // Infinite scroll implementation
    useEffect(() => {
        if (!hasNextPage || isFetching || !loadMoreRef.current) return

        const observer = new IntersectionObserver(
            (entries) => {
                const target = entries[0]
                if (target?.isIntersecting) {
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
                {isRecentlyReadMode ||
                Object.keys(groupedArticles).length === 0 ? (
                    // Simple list for recently read mode or when no grouping
                    <>
                        {filteredArticles.map((article, index) => (
                            <ArticleItem
                                key={article.id}
                                article={article}
                                isActive={selectedArticleId === article.id}
                                isLastInGroup={
                                    index === filteredArticles.length - 1
                                }
                                isRecentlyReadMode={isRecentlyReadMode}
                                onClick={() => onArticleSelect(article.id)}
                            />
                        ))}
                    </>
                ) : (
                    // Grouped articles with date headers
                    <>
                        {Object.entries(groupedArticles)
                            .sort(([a], [b]) => {
                                // Sort by date group - today first, then yesterday, then by date desc
                                if (a === "today") return -1
                                if (b === "today") return 1
                                if (a === "yesterday") return -1
                                if (b === "yesterday") return 1
                                return b.localeCompare(a) // Latest dates first
                            })
                            .map(([dateGroup, group]) => (
                                <div key={dateGroup}>
                                    {/* Date Header */}
                                    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-2">
                                        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                            <CalendarIcon className="h-4 w-4" />
                                            {group.label}
                                        </h3>
                                    </div>

                                    {/* Articles in this date group */}
                                    {group.articles.map((article, index) => (
                                        <ArticleItem
                                            key={article.id}
                                            article={article}
                                            isActive={
                                                selectedArticleId === article.id
                                            }
                                            isLastInGroup={
                                                index ===
                                                group.articles.length - 1
                                            }
                                            isRecentlyReadMode={
                                                isRecentlyReadMode
                                            }
                                            onClick={() =>
                                                onArticleSelect(article.id)
                                            }
                                        />
                                    ))}
                                </div>
                            ))}
                    </>
                )}

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
