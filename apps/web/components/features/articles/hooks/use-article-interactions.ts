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

        const updateData: { is_read: boolean; is_saved?: boolean } = {
            is_read: true,
        }

        // If in Read Later mode, marking as read should also unsave it
        // This triggers the optimistic removal from the Read Later list
        if (isReadLaterMode) {
            updateData.is_saved = false
        }

        updateArticle.mutate(
            {
                articleId: article.id,
                data: updateData,
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
                },
            },
            {
                onError: () => {
                    toast.error("Failed to update read later status")
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

    // Use isPending to show optimistic state immediately while mutation is in flight
    // This serves as a fallback if the cache update hasn't propagated yet
    const optimisticReadLater =
        updateArticle.isPending &&
            updateArticle.variables?.articleId === article.id &&
            updateArticle.variables.data.is_saved !== undefined
            ? updateArticle.variables.data.is_saved
            : article.is_saved

    const optimisticIsRead =
        updateArticle.isPending &&
            updateArticle.variables?.articleId === article.id &&
            updateArticle.variables.data.is_read !== undefined
            ? updateArticle.variables.data.is_read
            : article.is_read

    return {
        hasMarkedRead,
        optimisticReadLater,
        optimisticIsRead,
        handleMarkAsRead,
        handleToggleReadLater,
        handleScrollMarkAsRead,
        handleContentClickMarkAsRead,
    }
}
