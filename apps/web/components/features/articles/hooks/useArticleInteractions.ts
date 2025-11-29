import {
    useUpdateArticle,
    type Article,
    RSS_QUERY_KEYS,
} from "@readspace/shared"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"

interface ArticlesPageData {
    items: Article[]
    total: number
    page: number
    has_more: boolean
}

interface ArticlesInfiniteData {
    pages: ArticlesPageData[]
    pageParams: unknown[]
}

interface UnreadCountsData {
    total_unread: number
    read_later_count: number
    [key: string]: number
}

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

    const queryClient = useQueryClient()
    const updateArticle = useUpdateArticle()

    // Reset read state when article ID changes
    useEffect(() => {
        setHasMarkedRead(false)
    }, [article.id])

    const handleMarkAsRead = () => {
        // Mark as read and remove from read later instantly
        setHasMarkedRead(true)
        toast.success("Article marked as read")

        if (onMarkAsRead) {
            onMarkAsRead()
            return
        }

        // Optimistically update the articles cache to instantly remove from read-later list
        queryClient.setQueriesData(
            { queryKey: [RSS_QUERY_KEYS.ARTICLES] },
            (oldData: ArticlesInfiniteData | undefined) => {
                if (!oldData?.pages) return oldData
                return {
                    ...oldData,
                    pages: oldData.pages.map((page: ArticlesPageData) => ({
                        ...page,
                        items:
                            page.items
                                ?.filter((item: Article) =>
                                    // In read-later mode, remove this article entirely
                                    isReadLaterMode
                                        ? item.id !== article.id
                                        : true
                                )
                                .map((item: Article) =>
                                    item.id === article.id
                                        ? {
                                              ...item,
                                              is_read: true,
                                              is_saved: false,
                                          }
                                        : item
                                ) || [],
                    })),
                }
            }
        )

        // Also update unread counts optimistically
        queryClient.setQueryData(
            [RSS_QUERY_KEYS.UNREAD_COUNTS],
            (oldData: UnreadCountsData | undefined) => {
                if (!oldData) return oldData
                return {
                    ...oldData,
                    read_later_count: Math.max(
                        0,
                        (oldData.read_later_count || 0) - 1
                    ),
                }
            }
        )

        updateArticle.mutate(
            {
                articleId: article.id,
                data: {
                    is_read: true,
                    is_saved: false,
                },
            },
            {
                onSuccess: () => {
                    // Only remove from list after successful mutation
                    onArticleRemoved?.()
                },
                onError: () => {
                    // Revert optimistic update on error
                    setHasMarkedRead(false)
                    toast.error(
                        "Failed to mark article as read. Please try again."
                    )

                    // Revert cache optimistic updates
                    queryClient.invalidateQueries({
                        queryKey: [RSS_QUERY_KEYS.ARTICLES],
                    })
                    queryClient.invalidateQueries({
                        queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
                    })
                },
            }
        )
    }

    const handleToggleReadLater = () => {
        const newReadLaterState = !article.is_saved

        // Optimistically update the articles cache
        queryClient.setQueriesData(
            { queryKey: [RSS_QUERY_KEYS.ARTICLES] },
            (oldData: ArticlesInfiniteData | undefined) => {
                if (!oldData?.pages) return oldData
                return {
                    ...oldData,
                    pages: oldData.pages.map((page: ArticlesPageData) => ({
                        ...page,
                        items:
                            page.items?.map((item: Article) =>
                                item.id === article.id
                                    ? {
                                          ...item,
                                          is_saved: newReadLaterState,
                                      }
                                    : item
                            ) || [],
                    })),
                }
            }
        )

        // Show toast immediately for instant feedback
        toast.success(
            newReadLaterState
                ? "Article saved to Read Later"
                : "Article removed from Read Later"
        )

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
                    // Revert optimistic update on error and show error
                    queryClient.invalidateQueries({
                        queryKey: [RSS_QUERY_KEYS.ARTICLES],
                    })
                    toast.error("Failed to update article. Please try again.")
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
            setHasMarkedRead(true)

            if (onMarkAsRead) {
                onMarkAsRead()
            } else {
                // Optimistically update the UI immediately
                queryClient.setQueriesData(
                    { queryKey: [RSS_QUERY_KEYS.ARTICLES] },
                    (oldData: ArticlesInfiniteData | undefined) => {
                        if (!oldData?.pages) return oldData
                        return {
                            ...oldData,
                            pages: oldData.pages.map(
                                (page: ArticlesPageData) => ({
                                    ...page,
                                    items:
                                        page.items?.map((item: Article) =>
                                            item.id === article.id
                                                ? { ...item, is_read: true }
                                                : item
                                        ) || [],
                                })
                            ),
                        }
                    }
                )

                updateArticle.mutate({
                    articleId: article.id,
                    data: { is_read: true },
                })
            }
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
        optimisticReadLater: article.is_saved,
        handleMarkAsRead,
        handleToggleReadLater,
        handleScrollMarkAsRead,
        handleContentClickMarkAsRead,
    }
}
