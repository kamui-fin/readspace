"use client"

import { Article, ArticleFilterMode } from "@readspace/shared"
import { CalendarIcon } from "lucide-react"
import { ArticleItem } from "./ArticleItem"
import { ArticlesEmptyState } from "./ArticlesEmptyState"
import { ArticlesViewSkeleton } from "./ArticlesViewSkeleton"
import { useArticleGrouping } from "./hooks/use-article-grouping"
import { useArticleVirtualizer } from "./hooks/use-article-virtualizer"

interface ArticlesListProps {
    articles: Article[]
    selectedArticleId: string | null
    isLoading: boolean
    isFetchingNextPage: boolean
    hasNextPage: boolean
    showUnreadOnly: boolean
    isRecentlyReadMode?: boolean
    isReadLaterMode?: boolean
    isTodayMode?: boolean
    feedId?: string
    folderId?: string
    fetchNextPage: () => void
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
    // Group articles by date
    const { filteredArticles, allRows } = useArticleGrouping({
        articles,
        showUnreadOnly,
        isRecentlyReadMode,
        isTodayMode,
    })

    // Virtualization logic
    const { parentRef, rowVirtualizer, isSticky, isActiveSticky } =
        useArticleVirtualizer({
            allRows,
            hasNextPage,
            isFetchingNextPage,
            fetchNextPage,
            isRecentlyReadMode,
            isTodayMode,
        })

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
                        ? ArticleFilterMode.RecentlyRead
                        : isReadLaterMode
                            ? ArticleFilterMode.ReadLater
                            : isTodayMode
                                ? ArticleFilterMode.Today
                                : ArticleFilterMode.AllArticles
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
                                        background: "var(--background)",
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
