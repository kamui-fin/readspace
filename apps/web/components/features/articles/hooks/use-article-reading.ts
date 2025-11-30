import { useState, useEffect, useCallback } from "react"
import type { Article } from "@readspace/shared"

interface UseArticleReadingProps {
    article: Article | undefined
    onMarkAsRead?: () => void
}

export function useArticleReading({
    article,
    onMarkAsRead,
}: UseArticleReadingProps) {
    const [currentReadTime, setCurrentReadTime] = useState(0)

    // Update read time when article changes
    useEffect(() => {
        if (article) {
            setCurrentReadTime(article.estimated_read_time_minutes || 0)
        }
    }, [article])

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
        currentReadTime,
        handleScroll,
    }
}
