import { useUpdateArticle, type Article } from "@readspace/shared"
import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"

interface UseArticleInteractionsProps {
    article: Article
    isRecentlyReadMode: boolean
    isReadLaterMode: boolean
    shouldShowPreviewBanner: boolean
    isMobile: boolean
    onMarkAsRead?: () => void
    onArticleRemoved?: () => void
}

export function useArticleInteractions({
    article,
    isRecentlyReadMode,
    isReadLaterMode,
    shouldShowPreviewBanner,
    isMobile,
    onMarkAsRead,
    onArticleRemoved,
}: UseArticleInteractionsProps) {
    const [hasMarkedRead, setHasMarkedRead] = useState(false)
    const updateArticle = useUpdateArticle()

    // Reset read state when article ID changes
    useEffect(() => {
        setHasMarkedRead(false)
    }, [article.id])

    const handleMarkAsRead = () => {
        // Allow if in read later mode (to unsave) or if not read yet
        if (hasMarkedRead || (article.is_read && !isReadLaterMode)) return

        setHasMarkedRead(true)
        if (onMarkAsRead) {
            onMarkAsRead()
            return
        }

        updateArticle.mutate(
            {
                articleId: article.id,
                data: {
                    is_read: true,
                },
            },
            {
                onSuccess: () => {
                    onArticleRemoved?.()
                },
                onError: () => {
                    setHasMarkedRead(false)
                },
            }
        )
    }

    const handleToggleReadLater = () => {
        const newReadLaterState = !article.is_saved

        updateArticle.mutate(
            {
                articleId: article.id,
                data: {
                    is_saved: newReadLaterState,
                    // When saving for later, mark as unread to update sidebar count
                    is_read: newReadLaterState ? false : article.is_read,
                },
            },
            {
                onError: () => {
                },
            }
        )
    }

    const handleScrollMarkAsRead = (scrollTop: number) => {
        if (
            isRecentlyReadMode ||
            isReadLaterMode ||
            shouldShowPreviewBanner ||
            hasMarkedRead ||
            article.is_read ||
            isMobile
        )
            return

        // Mark as read on minimal scroll (just 50px) to be more responsive
        if (scrollTop > 50) {
            handleMarkAsRead()
        }
    }

    const handleContentClickMarkAsRead = () => {
        // Mark as read on content click (desktop only, not in preview or read modes)
        if (
            !isRecentlyReadMode &&
            !isReadLaterMode &&
            !shouldShowPreviewBanner &&
            !article.is_read &&
            !isMobile
        ) {
            handleMarkAsRead()
        }
    }

    return {
        hasMarkedRead,
        optimisticReadLater: article.is_saved, // We can just use the article state now as it's optimistically updated by the cache
        handleMarkAsRead,
        handleToggleReadLater,
        handleScrollMarkAsRead,
        handleContentClickMarkAsRead,
    }
}
