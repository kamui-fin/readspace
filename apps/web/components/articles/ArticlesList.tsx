"use client"

import type { Article } from "@readspace/shared"
import type { Range } from "@tanstack/react-virtual"
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual"
import { format, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef } from "react"
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
    /** Whether the next page is being fetched */
    isFetchingNextPage: boolean
    /** Whether there are more articles to load */
    hasNextPage: boolean | undefined
    /** Whether to show only unread articles */
    showUnreadOnly: boolean
    /** Whether in recently read mode */
    isRecentlyReadMode?: boolean
    /** Whether in read later mode */
    isReadLaterMode?: boolean
    /** Whether in today mode */
    isTodayMode?: boolean
    /** Sidebar title for the current view */
    sidebarTitle?: string
    /** Feed ID for empty state */
    feedId?: string
    /** Folder ID for empty state */
    folderId?: string
    /** Function to fetch next page of articles */
    fetchNextPage: () => void
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
    isFetchingNextPage,
    hasNextPage,
    showUnreadOnly,
    isRecentlyReadMode = false,
    isReadLaterMode = false,
    isTodayMode = false,
    feedId,
    folderId,
    fetchNextPage,
    onArticleSelect,
}: ArticlesListProps) {
    const parentRef = useRef<HTMLDivElement>(null)
    const activeStickyIndexRef = useRef(0)

    // Generate a stable key based on article data to force virtualizer reset on significant changes
    // This prevents overlapping items when new articles are inserted after refresh
    const virtualizerKey = useMemo(() => {
        if (articles.length === 0) return "empty"
        const firstId = articles[0]?.id || ""
        const lastId = articles[articles.length - 1]?.id || ""
        return `${firstId}-${lastId}-${articles.length}`
    }, [articles])

    // Filter articles based on unread toggle
    const filteredArticles = showUnreadOnly
        ? articles.filter((article) => !article.is_read)
        : articles

    // For virtualization, we need a flat list of all items
    const allRows = useMemo(() => {
        if (isRecentlyReadMode || isTodayMode || filteredArticles.length === 0) {
            return filteredArticles
        }

        // Create flat list with date headers and articles
        const rows: (
            | Article
            | { type: "header"; label: string; dateGroup: string }
        )[] = []
        const groups: Record<string, { label: string; articles: Article[] }> =
            {}

        // Group articles by date
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

        // Flatten groups into rows with headers
        Object.entries(groups)
            .sort(([a], [b]) => {
                if (a === "today") return -1
                if (b === "today") return 1
                if (a === "yesterday") return -1
                if (b === "yesterday") return 1
                return b.localeCompare(a)
            })
            .forEach(([dateGroup, group]) => {
                rows.push({ type: "header", label: group.label, dateGroup })
                // Sort articles within each date group by published time (newest first)
                const sortedArticles = group.articles.sort((a, b) => {
                    if (!a.published_at) return 1
                    if (!b.published_at) return -1
                    return parseISO(b.published_at).getTime() - parseISO(a.published_at).getTime()
                })
                rows.push(...sortedArticles)
            })

        return rows
    }, [filteredArticles, isRecentlyReadMode])

    // Get sticky indexes (header positions)
    // Only enable sticky headers when we actually have date headers (not in recently read or today mode)
    const stickyIndexes = useMemo(() => {
        if (isRecentlyReadMode || isTodayMode) return []

        const indexes: number[] = []
        allRows.forEach((row, index) => {
            if (row && "type" in row && row.type === "header") {
                indexes.push(index)
            }
        })
        return indexes
    }, [allRows, isRecentlyReadMode, isTodayMode])

    // Helper functions for sticky behavior
    const isSticky = useCallback(
        (index: number) => stickyIndexes.includes(index),
        [stickyIndexes]
    )
    const isActiveSticky = useCallback(
        (index: number) =>
            stickyIndexes.length > 0 && activeStickyIndexRef.current === index,
        [stickyIndexes.length]
    )

    // TanStack Virtual configuration with sticky support
    const rowVirtualizer = useVirtualizer({
        count: hasNextPage ? allRows.length + 1 : allRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => {
            const item = allRows[index]
            if (!item) return 120 // Loading indicator
            if ("type" in item && item.type === "header") return 36 // Reasonable header height
            return 120 // Article item height
        },
        overscan: 5,
        rangeExtractor: useCallback(
            (range: Range) => {
                activeStickyIndexRef.current =
                    [...stickyIndexes]
                        .reverse()
                        .find((index) => range.startIndex >= index) ?? 0

                const next = new Set([
                    activeStickyIndexRef.current,
                    ...defaultRangeExtractor(range),
                ])

                return [...next].sort((a, b) => a - b)
            },
            [stickyIndexes]
        ),
    })

    // Force virtualizer to recalculate measurements when articles data changes
    // This is needed in addition to the key-based remount for edge cases
    useEffect(() => {
        if (allRows.length > 0) {
            rowVirtualizer.measure()
        }
    }, [allRows.length, rowVirtualizer])

    // Infinite scroll: automatically fetch next page when last item is visible
    // This follows the TanStack Virtual + React Query pattern
    useEffect(() => {
        // Get the last virtual item from the virtualizer
        const virtualItems = rowVirtualizer.getVirtualItems()
        const [lastItem] = [...virtualItems].reverse()

        if (!lastItem) {
            return
        }

        // Fetch next page when:
        // 1. We've reached or passed the last item in allRows
        // 2. There are more pages available
        // 3. We're not already fetching
        if (
            lastItem.index >= allRows.length - 1 &&
            hasNextPage &&
            !isFetchingNextPage
        ) {
            fetchNextPage()
        }
    }, [
        hasNextPage,
        fetchNextPage,
        allRows.length,
        isFetchingNextPage,
        rowVirtualizer.getVirtualItems(),
    ])

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
                          : isTodayMode
                            ? "today"
                            : "allArticles"
                }
                feedId={feedId}
                folderId={folderId}
            />
        )
    }

    return (
        <div
            ref={parentRef}
            className="h-full w-full overflow-auto scroll-smooth"
            style={{ scrollbarGutter: "stable" }}
        >
            <div
                style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                }}
            >
                {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                    const item = allRows[virtualItem.index]
                    const isLoaderRow = virtualItem.index > allRows.length - 1
                    const isStickyItem = isSticky(virtualItem.index)
                    const isActiveStickyItem = isActiveSticky(virtualItem.index)

                    // Check if this is the last article item before a header or end
                    const nextItem = allRows[virtualItem.index + 1]
                    const isLastArticleInGroup =
                        item &&
                        !("type" in item) &&
                        (!nextItem ||
                            ("type" in nextItem && nextItem.type === "header"))

                    return (
                        <div
                            key={virtualItem.index}
                            style={{
                                ...(isStickyItem && isActiveStickyItem
                                    ? {
                                          background: "hsl(var(--background))",
                                          zIndex: 10,
                                      }
                                    : {}),
                                ...(isActiveStickyItem
                                    ? {
                                          position: "sticky",
                                      }
                                    : {
                                          position: "absolute",
                                          transform: `translateY(${virtualItem.start}px)`,
                                      }),
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: `${virtualItem.size}px`,
                            }}
                        >
                            {isLoaderRow ? (
                                // Loading indicator
                                hasNextPage && isFetchingNextPage ? (
                                    <div className="flex justify-center py-4">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                            Loading more articles...
                                        </div>
                                    </div>
                                ) : null
                            ) : item ? (
                                <>
                                    {"type" in item &&
                                    item.type === "header" ? (
                                        // Date Header with reasonable 48px height
                                        <div
                                            className={`flex items-center gap-2 px-4 py-2 bg-background/95 backdrop-blur-sm ${isActiveStickyItem ? "border-b" : ""}`}
                                        >
                                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                            <h3 className="text-sm font-medium text-muted-foreground">
                                                {item.label}
                                            </h3>
                                        </div>
                                    ) : (
                                        // Article Item with consistent height
                                        <div className="h-[120px] overflow-hidden">
                                            <ArticleItem
                                                key={(item as Article).id}
                                                article={item as Article}
                                                isActive={
                                                    selectedArticleId ===
                                                    (item as Article).id
                                                }
                                                isLastInGroup={
                                                    isLastArticleInGroup
                                                }
                                                isRecentlyReadMode={
                                                    isRecentlyReadMode
                                                }
                                                onClick={() =>
                                                    onArticleSelect(
                                                        (item as Article).id
                                                    )
                                                }
                                            />
                                        </div>
                                    )}
                                </>
                            ) : null}
                        </div>
                    )
                })}
            </div>

            {/* End indicator */}
            {!hasNextPage && allRows.length > 0 && (
                <div className="py-8 text-center">
                    <p className="text-xs text-muted-foreground">
                        You&apos;ve reached the end of the articles
                    </p>
                </div>
            )}
        </div>
    )
}
