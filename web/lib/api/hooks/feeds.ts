import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { ApiClient } from "../client"

// Types based on API responses
type Folder = {
    id: string
    name: string
    user_id: string
    created_at: string
}

export type Feed = {
    id: string
    title: string
    url: string
    description: string
    image_url: string | null
    folder_id: string | null
    folder_name: string | null
    is_favorite: boolean
    last_fetched_at: string | null
    tags: { id: string; name: string }[]
    unread_count: number
    fetch_error_count: number
    last_error_message: string | null
    last_article_published_at: string | null
}

// OPML Import types
export type OPMLImportResponse = {
    processing_mode: "background"
    task_id: string
    message: string
    estimated_feeds: number
    check_status_url: string
    // Results when completed (in task status)
    imported_count?: number
    failed_count?: number
    total_feeds?: number
    errors?: Array<{
        url: string
        title: string
        error: string
        status: string
    }>
    broken_feeds?: Array<{
        url: string
        title: string
        error: string
        status: string
    }>
    summary?: {
        successful: number
        already_existed: number
        broken_feeds: number
        temporary_errors: number
        fetch_failures: number
        invalid_feeds: number
    }
}

export type ImportTaskStatus = {
    task_id: string
    status: "pending" | "in_progress" | "completed" | "failed"
    message: string
    result?: OPMLImportResponse
    error?: string
}

// Corresponds to FeedBasicInfo in rss_schemas.py
export type FeedBasicInfo = {
    id: string // Changed from UUID to string for frontend consistency, assuming conversion happens
    title: string | null
    url: string // Changed from HttpUrl to string
    image_url: string | null // Changed from HttpUrl to string
}

// Export the Article type
export type Article = {
    id: string
    feed_id: string
    // feed_title: string; // This will now come from the nested feed object if needed
    title: string
    link: string // Changed from url to link, matches backend model
    description: string | null // Made nullable to match schema (Optional[str])
    content: string | null // Made nullable to match schema (Optional[str])
    image_url: string | null
    author: string | null // Kept, though not explicitly in ArticleBase, might be populated
    published_at: string | null // Made nullable to match schema (Optional[datetime])
    is_read: boolean
    read_at: string | null
    is_read_later: boolean
    is_favorite: boolean
    created_at: string
    updated_at: string // Added
    user_id: string // Added
    guid: string // Added
    estimated_read_time_minutes: number | null // Added, made nullable
    custom_metadata: any | null // Added (JSONB maps to any)
    feed?:
        | FeedBasicInfo
        | {
              id: string | null
              title: string | null
              url: string | null
              image_url: string | null
          } // More flexible feed object for both RSS and clipped articles
    article_type: "feed" | "clipped"
    priority?: string | null // Added for clipped articles
    note?: string | null // Added for clipped articles
}

// Ensure PaginatedResponse is also exported if it wasn't already
export type PaginatedResponse<T> = {
    items: T[]
    total: number
    page: number
    size: number
    pages: number
}

// Query keys
export const RSS_QUERY_KEYS = {
    FOLDERS: "rss-folders",
    FEEDS: "rss-feeds",
    ARTICLES: "rss-articles",
    ARTICLE: "rss-article",
    UNREAD_COUNTS: "rss-unread-counts",
    OPML_IMPORT_STATUS: "opml-import-status",
    REFRESH_STATUS: "refresh-status",
}

// OPML Import hooks
export function useImportOPML() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (formData: FormData) =>
            ApiClient.uploadFile(
                "/api/rss/opml/import",
                formData
            ) as Promise<OPMLImportResponse>,
        onSuccess: (data) => {
            // All imports are background now - queries will be invalidated when task completes
            // No immediate invalidation needed
        },
    })
}

export function useImportTaskStatus(
    taskId: string | null,
    enabled: boolean = true
) {
    return useQuery({
        queryKey: [RSS_QUERY_KEYS.OPML_IMPORT_STATUS, taskId],
        queryFn: () =>
            ApiClient.get<ImportTaskStatus>(
                `/api/rss/opml/import/status/${taskId}`
            ),
        enabled: !!taskId && enabled,
        refetchInterval: 3000, // Poll every 3 seconds - we'll handle stopping in the component
        retry: false, // Don't retry failed status checks
    })
}

// Folder hooks
export function useFolders() {
    return useQuery({
        queryKey: [RSS_QUERY_KEYS.FOLDERS],
        queryFn: () => ApiClient.get<Folder[]>("/api/rss/folders"),
    })
}

export function useCreateFolder() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (folder: { name: string }) =>
            ApiClient.post<Folder>("/api/rss/folders", folder),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.FOLDERS],
            })
        },
    })
}

export function useUpdateFolder() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ folderId, name }: { folderId: string; name: string }) =>
            ApiClient.put<Folder>(`/api/rss/folders/${folderId}`, { name }),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.FOLDERS],
            })
        },
    })
}

export function useDeleteFolder() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (folderId: string) => {
            // Expecting a 200 OK with { "ok": true } based on actual backend code
            const response = await ApiClient.rss.deleteFolder(folderId)
            // Assuming ApiClient.rss.deleteFolder returns the parsed JSON or handles it.
            // If it throws on non-JSON for a 200, ApiClient itself needs a fix.
            // If it returns the raw Response object, we'd parse here.
            // For now, let's assume it returns something like { ok: true } or throws on HTTP error.
            return response // Return the actual response from the API call
        },
        onMutate: async (folderId: string) => {
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.FOLDERS],
            })
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.FEEDS],
            }) // Feeds might be affected
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLES],
            }) // Articles might be affected
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
            }) // Unread counts will be affected

            const previousFolders = queryClient.getQueryData<Folder[]>([
                RSS_QUERY_KEYS.FOLDERS,
            ])
            const previousFeeds = queryClient.getQueryData<Feed[]>([
                RSS_QUERY_KEYS.FEEDS,
            ])
            // Articles and unread counts are harder to predict changes for optimistically in a simple way for folder deletion,
            // as it involves cascading deletes. We'll rely on onSettled invalidation for these.

            queryClient.setQueryData<Folder[]>(
                [RSS_QUERY_KEYS.FOLDERS],
                (old) => old?.filter((folder) => folder.id !== folderId)
            )
            queryClient.setQueryData<Feed[]>([RSS_QUERY_KEYS.FEEDS], (old) =>
                old?.filter((feed) => feed.folder_id !== folderId)
            )

            return { previousFolders, previousFeeds }
        },
        onError: (_err, _folderId, context) => {
            if (context?.previousFolders) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.FOLDERS],
                    context.previousFolders
                )
            }
            if (context?.previousFeeds) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.FEEDS],
                    context.previousFeeds
                )
            }
            toast.error("Failed to delete folder. Restoring previous state.")
        },
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.FOLDERS],
            })
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLES],
            })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
            })
        },
    })
}

// Feed hooks
export function useFeeds(params?: {
    folderId?: string
    tagNames?: string[]
    isFavorite?: boolean
    searchQuery?: string
}) {
    // Build query string from params
    const queryParams = new URLSearchParams()
    if (params?.folderId) queryParams.append("folder_id", params.folderId)
    if (params?.tagNames)
        params.tagNames.forEach((tag) => queryParams.append("tag_names", tag))
    if (params?.isFavorite !== undefined)
        queryParams.append("is_favorite", params.isFavorite.toString())
    if (params?.searchQuery)
        queryParams.append("search_query", params.searchQuery)

    const queryString = queryParams.toString()
    const url = `/api/rss/feeds${queryString ? `?${queryString}` : ""}`

    return useQuery({
        queryKey: [RSS_QUERY_KEYS.FEEDS, params],
        queryFn: () => ApiClient.get<Feed[]>(url),
    })
}

export function useFeed(feedId: string) {
    return useQuery({
        queryKey: [RSS_QUERY_KEYS.FEEDS, feedId],
        queryFn: () => ApiClient.get<Feed>(`/api/rss/feeds/${feedId}`),
        enabled: !!feedId,
    })
}

export function useCreateFeed() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (feed: {
            url: string
            folder_id?: string
            tag_ids?: string[]
        }) => ApiClient.post<Feed>("/api/rss/feeds", feed),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] })
        },
    })
}

export function useUpdateFeed() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({
            feedId,
            data,
        }: {
            feedId: string
            data: {
                folder_id?: string
                tag_ids?: string[]
                is_favorite?: boolean
                title?: string
            }
        }) => ApiClient.rss.updateFeed(feedId, data),
        onSuccess: (_, { feedId }) => {
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.FEEDS, feedId],
            })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLES],
            })
        },
    })
}

export function useRefreshFeed() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({
            feedId,
            forceRefetch = false,
            silent = false, // Add silent option
        }: {
            feedId: string
            forceRefetch?: boolean
            silent?: boolean // Option to suppress toasts
        }) => {
            const queryParams = new URLSearchParams()
            if (forceRefetch) queryParams.append("force_refetch", "true")
            return ApiClient.post<Feed>(
                `/api/rss/feeds/${feedId}/refresh${queryParams.toString() ? `?${queryParams.toString()}` : ""}`
            )
        },
        onSuccess: (_, { feedId, silent }) => {
            if (!silent) {
                toast.success(
                    `Feed '${feedId.substring(0, 8)}...' refresh initiated.`
                )
            }
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.FEEDS, feedId],
            })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLES],
            })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
            })
        },
        onError: (error: any, { feedId, silent }) => {
            if (!silent) {
                toast.error(
                    error.response?.data?.detail ||
                        `Failed to refresh feed '${feedId.substring(0, 8)}...'.`
                )
            }
        },
    })
}

export function useRefreshFolderFeeds() {
    return useMutation({
        mutationFn: (folderId: string) =>
            ApiClient.post(`/api/rss/feeds/refresh_folder/${folderId}`),
        onSuccess: (data) => {
            toast.success("Folder refresh started! Check status for progress.")
            return data
        },
        onError: (error: any) => {
            toast.error(
                error.response?.data?.detail ||
                    "Failed to start folder refresh."
            )
        },
    })
}

export function useRefreshAllFeeds() {
    return useMutation({
        mutationFn: () => ApiClient.post("/api/rss/feeds/refresh_all"),
        onSuccess: (data) => {
            toast.success(
                "All feeds refresh started! Check status for progress."
            )
            return data
        },
        onError: (error: any) => {
            toast.error(
                error.response?.data?.detail ||
                    "Failed to start all feeds refresh."
            )
        },
    })
}

export function useRefreshStatus(
    taskId: string | null,
    enabled: boolean = true
) {
    return useQuery({
        queryKey: [RSS_QUERY_KEYS.REFRESH_STATUS, taskId],
        queryFn: () => ApiClient.get(`/api/rss/feeds/refresh_status/${taskId}`),
        enabled: enabled && !!taskId,
        refetchInterval: 2000, // Poll every 2 seconds
        refetchIntervalInBackground: false,
    })
}

export function useDeleteFeed() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (feedId: string) => {
            await ApiClient.rss.deleteFeed(feedId)
            return null // Explicitly return a non-JSON value after successful await
        },
        onMutate: async (feedId: string) => {
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.FEEDS, feedId],
            })
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.FEEDS],
            })
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLES],
            }) // Articles for this feed will be gone
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
            }) // Unread counts will change

            const previousFeed = queryClient.getQueryData<Feed>([
                RSS_QUERY_KEYS.FEEDS,
                feedId,
            ])
            const previousFeeds = queryClient.getQueryData<Feed[]>([
                RSS_QUERY_KEYS.FEEDS,
            ])

            queryClient.setQueryData<Feed[]>([RSS_QUERY_KEYS.FEEDS], (old) =>
                old?.filter((feed) => feed.id !== feedId)
            )
            // Individual feed query might not be necessary to update if list is updated
            // queryClient.setQueryData<Feed | undefined>([RSS_QUERY_KEYS.FEEDS, feedId], undefined);

            return { previousFeed, previousFeeds }
        },
        onError: (_err, feedId, context) => {
            if (context?.previousFeeds) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.FEEDS],
                    context.previousFeeds
                )
            }
            // If you were storing individual feed data separately and optimistically removed it:
            // if (context?.previousFeed) {
            //     queryClient.setQueryData([RSS_QUERY_KEYS.FEEDS, feedId], context.previousFeed);
            // }
            toast.error("Failed to unfollow feed. Restoring previous state.")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLES],
            })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
            })
        },
    })
}

// Article hooks
export function useArticles(
    params: {
        feedIds?: string[]
        folderId?: string
        isRead?: boolean
        isReadLater?: boolean
        isFavorite?: boolean
        feedIsFavorite?: boolean
        publishedSince?: string
        publishedUntil?: string
        searchQuery?: string
        sortBy?: string
        sortOrder?: string
        page?: number
        size?: number
    },
    options?: {
        keepPreviousData?: boolean
        refetchOnMount?: boolean | "always"
        refetchOnWindowFocus?: boolean | "always"
        staleTime?: number
    }
) {
    // Build query string from params
    const queryParams = new URLSearchParams()
    if (params.feedIds)
        params.feedIds.forEach((id) => queryParams.append("feed_ids", id))
    if (params.folderId) queryParams.append("folder_id", params.folderId)
    if (params.isRead !== undefined)
        queryParams.append("is_read", params.isRead.toString())
    if (params.isReadLater !== undefined)
        queryParams.append("is_read_later", params.isReadLater.toString())
    if (params.isFavorite !== undefined)
        queryParams.append("is_favorite", params.isFavorite.toString())
    if (params.feedIsFavorite !== undefined)
        queryParams.append("feed_is_favorite", params.feedIsFavorite.toString())
    if (params.publishedSince)
        queryParams.append("published_since", params.publishedSince)
    if (params.publishedUntil)
        queryParams.append("published_until", params.publishedUntil)
    if (params.searchQuery)
        queryParams.append("search_query", params.searchQuery)
    if (params.sortBy) queryParams.append("sort_by", params.sortBy)
    if (params.sortOrder) queryParams.append("sort_order", params.sortOrder)
    if (params.page) queryParams.append("page", params.page.toString())
    if (params.size) queryParams.append("size", params.size.toString())

    const queryString = queryParams.toString()
    const url = `/api/rss/articles${queryString ? `?${queryString}` : ""}`

    return useQuery({
        queryKey: [RSS_QUERY_KEYS.ARTICLES, params],
        queryFn: () => ApiClient.get<PaginatedResponse<Article>>(url),
        ...options,
    })
}

export function useRecentlyReadArticles(
    params: { page?: number; size?: number } = {}
) {
    const queryParams = new URLSearchParams()
    if (params.page) queryParams.append("page", params.page.toString())
    if (params.size) queryParams.append("size", params.size.toString())

    const queryString = queryParams.toString()
    const url = `/api/rss/articles/recently_read${queryString ? `?${queryString}` : ""}`

    return useQuery({
        queryKey: [RSS_QUERY_KEYS.ARTICLES, "recently_read", params],
        queryFn: () => ApiClient.get<PaginatedResponse<Article>>(url),
    })
}

export function useReadLaterArticles(
    params: { page?: number; size?: number } = {}
) {
    const queryParams = new URLSearchParams()
    if (params.page) queryParams.append("page", params.page.toString())
    if (params.size) queryParams.append("size", params.size.toString())

    const queryString = queryParams.toString()
    const url = `/api/rss/articles/read_later${queryString ? `?${queryString}` : ""}`

    return useQuery({
        queryKey: [RSS_QUERY_KEYS.ARTICLES, "read_later", params],
        queryFn: () => ApiClient.get<PaginatedResponse<Article>>(url),
    })
}

export function useUnreadCounts(folderId?: string) {
    const queryParams = new URLSearchParams()
    if (folderId) queryParams.append("folder_id", folderId)

    const queryString = queryParams.toString()
    const url = `/api/rss/articles/unread_counts${queryString ? `?${queryString}` : ""}`

    return useQuery({
        queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS, folderId],
        queryFn: () =>
            ApiClient.get<{
                total_unread: number
                unread_by_folder?: {
                    folder_id: string
                    name: string
                    unread_count: number
                }[]
                folder_unread?: {
                    folder_id: string
                    name: string
                    count: number
                }
            }>(url),
    })
}

export function useArticle(articleId: string) {
    return useQuery({
        queryKey: [RSS_QUERY_KEYS.ARTICLE, articleId],
        queryFn: () => ApiClient.get<Article>(`/api/rss/articles/${articleId}`),
        enabled: !!articleId,
    })
}

export function useUpdateArticle() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({
            articleId,
            data,
        }: {
            articleId: string
            data: {
                is_read?: boolean
                read_at?: string
                is_read_later?: boolean
                is_favorite?: boolean
            }
        }) => ApiClient.put<Article>(`/api/rss/articles/${articleId}`, data),
        onSuccess: (_, { articleId }) => {
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLE, articleId],
            })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLES],
            })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
            })
        },
    })
}

export function useBulkUpdateArticles() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({
            articleIds,
            action,
        }: {
            articleIds: string[]
            action:
                | "mark_as_read"
                | "mark_as_unread"
                | "mark_as_read_later"
                | "unmark_as_read_later"
                | "mark_as_favorite"
                | "unmark_as_favorite"
        }) =>
            ApiClient.post<{ affected_articles: number }>(
                `/api/rss/articles/bulk_update`,
                {
                    article_ids: articleIds,
                    action,
                }
            ),
        onMutate: async ({ articleIds, action }) => {
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLES],
            })
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
            })

            const previousArticlesPages = queryClient.getQueriesData<
                PaginatedResponse<Article>
            >({ queryKey: [RSS_QUERY_KEYS.ARTICLES] })
            const previousUnreadCounts = queryClient.getQueryData([
                RSS_QUERY_KEYS.UNREAD_COUNTS,
            ])

            queryClient.setQueriesData<PaginatedResponse<Article>>(
                { queryKey: [RSS_QUERY_KEYS.ARTICLES] },
                (oldData) => {
                    if (!oldData) return oldData
                    return {
                        ...oldData,
                        items: oldData.items.map((article) => {
                            if (articleIds.includes(article.id)) {
                                switch (action) {
                                    case "mark_as_read":
                                        return { ...article, is_read: true }
                                    case "mark_as_unread":
                                        return { ...article, is_read: false }
                                    case "mark_as_read_later":
                                        return {
                                            ...article,
                                            is_read_later: true,
                                        }
                                    case "unmark_as_read_later":
                                        return {
                                            ...article,
                                            is_read_later: false,
                                        }
                                    case "mark_as_favorite":
                                        return { ...article, is_favorite: true }
                                    case "unmark_as_favorite":
                                        return {
                                            ...article,
                                            is_favorite: false,
                                        }
                                    default:
                                        return article
                                }
                            }
                            return article
                        }),
                    }
                }
            )

            // Optimistically update unread counts if marking as read/unread
            if (action === "mark_as_read" || action === "mark_as_unread") {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.UNREAD_COUNTS],
                    (oldCounts: any) => {
                        if (!oldCounts) return oldCounts
                        // This is a simplified optimistic update for unread counts.
                        // A more accurate update would need to know which folder/feed these articles belong to.
                        // For now, we rely on onSettled invalidation for accuracy here.
                        // However, we can adjust total_unread at least based on the number of articles affected.
                        let newTotalUnread = oldCounts.total_unread
                        // To do this more accurately, we would need to check which of the articleIds were previously unread.
                        // This requires having access to the article data itself or making assumptions.
                        // For a truly accurate optimistic update of counts, a more complex logic or backend returning affected counts would be better.
                        // For now, this is a placeholder for a more complex calculation if needed.
                        // if (action === "mark_as_read") {
                        //     newTotalUnread = Math.max(0, newTotalUnread - articleIds.length);
                        // } else { // mark_as_unread
                        //     newTotalUnread += articleIds.length;
                        // }
                        return { ...oldCounts, total_unread: newTotalUnread } // Temporarily not changing, relying on invalidation
                    }
                )
            }

            return { previousArticlesPages, previousUnreadCounts }
        },
        onError: (_err, _vars, context) => {
            context?.previousArticlesPages?.forEach(([queryKey, data]) => {
                queryClient.setQueryData(queryKey, data)
            })
            if (context?.previousUnreadCounts) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.UNREAD_COUNTS],
                    context.previousUnreadCounts
                )
            }
            toast.error("Failed to update articles. Restoring previous state.")
        },
        onSuccess: () => {
            // onSuccess is called after mutationFn is successful, but before onSettled
            // We might want to invalidate here if we are confident in the optimistic update
            // or wait for onSettled for a safer refetch.
        },
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLES],
            })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
            })
        },
    })
}

// Hook for marking all articles in a feed as read
export const useMarkFeedAsRead = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (feedId: string) => ApiClient.rss.markFeedAsRead(feedId),
        onMutate: async (feedId: string) => {
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLES],
            })
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
            })
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.FEEDS, feedId],
            }) // For feed specific unread count
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.FEEDS],
            }) // For list of feeds unread count

            const previousArticlesPages = queryClient.getQueriesData<
                PaginatedResponse<Article>
            >({ queryKey: [RSS_QUERY_KEYS.ARTICLES] })
            const previousUnreadCounts = queryClient.getQueryData([
                RSS_QUERY_KEYS.UNREAD_COUNTS,
            ])
            const previousFeed = queryClient.getQueryData<Feed>([
                RSS_QUERY_KEYS.FEEDS,
                feedId,
            ])
            const previousFeeds = queryClient.getQueryData<Feed[]>([
                RSS_QUERY_KEYS.FEEDS,
            ])

            // Optimistically update articles
            queryClient.setQueriesData<PaginatedResponse<Article>>(
                { queryKey: [RSS_QUERY_KEYS.ARTICLES] },
                (oldData) => {
                    if (!oldData) return oldData
                    return {
                        ...oldData,
                        items: oldData.items.map((article) =>
                            article.feed_id === feedId
                                ? { ...article, is_read: true }
                                : article
                        ),
                    }
                }
            )

            // Optimistically update unread counts
            queryClient.setQueryData(
                [RSS_QUERY_KEYS.UNREAD_COUNTS],
                (oldCounts: any) => {
                    if (!oldCounts) return oldCounts
                    // Find the feed and set its count to 0 for total_unread calculation
                    // This is a simplification. A more robust way would involve knowing original unread count of the feed.
                    return {
                        ...oldCounts,
                        total_unread: Math.max(
                            0,
                            oldCounts.total_unread -
                                (previousFeed?.unread_count || 0)
                        ),
                    }
                }
            )

            queryClient.setQueryData<Feed | undefined>(
                [RSS_QUERY_KEYS.FEEDS, feedId],
                (oldFeed) =>
                    oldFeed ? { ...oldFeed, unread_count: 0 } : undefined
            )
            queryClient.setQueryData<Feed[]>(
                [RSS_QUERY_KEYS.FEEDS],
                (oldFeeds) =>
                    oldFeeds?.map((f) =>
                        f.id === feedId ? { ...f, unread_count: 0 } : f
                    )
            )

            return {
                previousArticlesPages,
                previousUnreadCounts,
                previousFeed,
                previousFeeds,
            }
        },
        onError: (_err, feedId, context) => {
            context?.previousArticlesPages?.forEach(([queryKey, data]) => {
                queryClient.setQueryData(queryKey, data)
            })
            if (context?.previousUnreadCounts) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.UNREAD_COUNTS],
                    context.previousUnreadCounts
                )
            }
            if (context?.previousFeed) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.FEEDS, feedId],
                    context.previousFeed
                )
            }
            if (context?.previousFeeds) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.FEEDS],
                    context.previousFeeds
                )
            }
            toast.error(
                "Failed to mark feed as read. Restoring previous state."
            )
        },
        onSettled: async () => {
            // Invalidate queries that might be affected
            await queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLES],
            })
            await queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
            })
            await queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.FEEDS],
            })
        },
    })
}

// Hook for marking all articles in a folder as read
export const useMarkFolderAsRead = () => {
    const queryClient = useQueryClient()

    type UnreadCountsResponse = {
        total_unread: number
        unread_by_folder?: {
            folder_id: string
            name: string
            unread_count: number
        }[]
        folder_unread?: { folder_id: string; name: string; count: number } // Assuming this might exist based on useUnreadCounts hook
    }

    return useMutation({
        mutationFn: (folderId: string) =>
            ApiClient.rss.markFolderAsRead(folderId),
        onMutate: async (folderId: string) => {
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLES],
            })
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
            })
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.FEEDS],
            }) // Feeds in folder have unread counts

            const previousArticlesPages = queryClient.getQueriesData<
                PaginatedResponse<Article>
            >({ queryKey: [RSS_QUERY_KEYS.ARTICLES] })
            const previousUnreadCounts =
                queryClient.getQueryData<UnreadCountsResponse>([
                    RSS_QUERY_KEYS.UNREAD_COUNTS,
                ])
            const previousFeeds = queryClient.getQueryData<Feed[]>([
                RSS_QUERY_KEYS.FEEDS,
            ])

            // Optimistically update articles in the folder
            queryClient.setQueriesData<PaginatedResponse<Article>>(
                { queryKey: [RSS_QUERY_KEYS.ARTICLES] },
                (oldData) => {
                    if (!oldData) return oldData
                    return {
                        ...oldData,
                        items: oldData.items.map((article) => {
                            // Need to know which feed an article belongs to, and then that feed's folder_id
                            // This assumes article.feed.folder_id is available or article has direct folder_id
                            // The current Article type has feed_id, then feed object has folder_id
                            const articleFeed = previousFeeds?.find(
                                (f) => f.id === article.feed_id
                            )
                            if (articleFeed?.folder_id === folderId) {
                                return { ...article, is_read: true }
                            }
                            return article
                        }),
                    }
                }
            )

            // Optimistically update unread counts for the folder and total
            queryClient.setQueryData<UnreadCountsResponse | undefined>(
                [RSS_QUERY_KEYS.UNREAD_COUNTS],
                (oldCounts) => {
                    if (!oldCounts) return oldCounts
                    let newTotalUnread = oldCounts.total_unread
                    const folderUnread =
                        oldCounts.unread_by_folder?.find(
                            (f: any) => f.folder_id === folderId
                        )?.unread_count || 0
                    newTotalUnread = Math.max(0, newTotalUnread - folderUnread)

                    const newUnreadByFolder = oldCounts.unread_by_folder?.map(
                        (f: any) =>
                            f.folder_id === folderId
                                ? { ...f, unread_count: 0 }
                                : f
                    )
                    return {
                        ...oldCounts,
                        total_unread: newTotalUnread,
                        unread_by_folder: newUnreadByFolder,
                    }
                }
            )

            // Optimistically update unread counts on individual feeds within the folder
            queryClient.setQueryData<Feed[]>(
                [RSS_QUERY_KEYS.FEEDS],
                (oldFeeds) =>
                    oldFeeds?.map((f) =>
                        f.folder_id === folderId ? { ...f, unread_count: 0 } : f
                    )
            )

            return {
                previousArticlesPages,
                previousUnreadCounts,
                previousFeeds,
            }
        },
        onError: (_err, _folderId, context) => {
            context?.previousArticlesPages?.forEach(([queryKey, data]) => {
                queryClient.setQueryData(queryKey, data)
            })
            if (context?.previousUnreadCounts) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.UNREAD_COUNTS],
                    context.previousUnreadCounts
                )
            }
            if (context?.previousFeeds) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.FEEDS],
                    context.previousFeeds
                )
            }
            toast.error(
                "Failed to mark folder as read. Restoring previous state."
            )
        },
        onSettled: async () => {
            // Invalidate queries that might be affected
            await queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLES],
            })
            await queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
            })
            await queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.FEEDS],
            })
        },
    })
}
