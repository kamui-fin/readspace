import type { Range } from "@tanstack/react-virtual"
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { ArticleRow } from "./useArticleGrouping"

interface UseArticleVirtualizerProps {
    allRows: ArticleRow[]
    hasNextPage: boolean | undefined
    isFetchingNextPage: boolean
    fetchNextPage: () => void
    isRecentlyReadMode: boolean
    isTodayMode: boolean
}

export function useArticleVirtualizer({
    allRows,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isRecentlyReadMode,
    isTodayMode,
}: UseArticleVirtualizerProps) {
    const parentRef = useRef<HTMLDivElement>(null)
    const activeStickyIndexRef = useRef(0)

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
        rowVirtualizer,
    ])

    return {
        parentRef,
        rowVirtualizer,
        isSticky,
        isActiveSticky,
    }
}
