import { useCallback } from "react"
import type { Article } from "@readspace/shared"

interface UseArticleReadingProps {
    article: Article | undefined
    onMarkAsRead?: () => void
}

export function useArticleReading({
    article,
    onMarkAsRead,
}: UseArticleReadingProps) {
    // Scroll tracking for marking as read
    const handleScroll = useCallback(
        (scrollTop: number, scrollHeight: number, clientHeight: number) => {
            if (!article || article.is_read || !onMarkAsRead) return

            // Mark as read if scrolled to bottom (90%)
            const scrollPercentage = (scrollTop + clientHeight) / scrollHeight
            if (scrollPercentage > 0.9) {
                onMarkAsRead()
            }
        },
        [article, onMarkAsRead]
    )

    return {
        handleScroll,
    }
}
