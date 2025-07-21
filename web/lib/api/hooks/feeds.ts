import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
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
            ApiClient.rss.importOPML(formData) as Promise<OPMLImportResponse>,
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
        queryFn: () => ApiClient.rss.getImportTaskStatus(taskId!),
        enabled: !!taskId && enabled,
        refetchInterval: 3000, // Poll every 3 seconds - we'll handle stopping in the component
        retry: false, // Don't retry failed status checks
    })
}

// Folder hooks
export function useFolders() {
    return useQuery({
        queryKey: [RSS_QUERY_KEYS.FOLDERS],
        queryFn: () => ApiClient.rss.getFolders(),
    })
}

export function useCreateFolder() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (folder: { name: string }) =>
            ApiClient.rss.createFolder(folder),
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
            ApiClient.rss.updateFolder(folderId, { name }),
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
        onSuccess: () => {
            // Remove cached data first to force refresh
            queryClient.removeQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] })
            queryClient.removeQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLE] })
            queryClient.removeQueries({ queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS] })
            
            // Then invalidate to trigger refetch
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.FOLDERS],
            })
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLES],
            })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLE],
            })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
            })
        },
        onError: (error: unknown) => {
            toast.error(error instanceof Error ? error.message : "Failed to delete folder")
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
    return useQuery({
        queryKey: [RSS_QUERY_KEYS.FEEDS, params],
        queryFn: () => ApiClient.rss.getFeeds({
            folder_id: params?.folderId,
            tag_names: params?.tagNames,
            is_favorite: params?.isFavorite,
            search_query: params?.searchQuery,
        }),
    })
}

export function useFeed(feedId: string) {
    return useQuery({
        queryKey: [RSS_QUERY_KEYS.FEEDS, feedId],
        queryFn: () => ApiClient.rss.getFeed(feedId),
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
        }) => ApiClient.rss.createFeed(feed),
        onSuccess: () => {
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
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLE],
            })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
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
            return ApiClient.rss.refreshFeed(feedId, forceRefetch)
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
            ApiClient.rss.refreshFolderFeeds(folderId),
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
        mutationFn: () => ApiClient.rss.refreshAllFeeds(),
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
        queryFn: () => ApiClient.rss.getRefreshStatus(taskId!),
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
        onSuccess: () => {
            // Remove cached data first to force refresh
            queryClient.removeQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] })
            queryClient.removeQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLE] })
            queryClient.removeQueries({ queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS] })
            
            // Then invalidate to trigger refetch
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLES],
            })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLE],
            })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
            })
        },
        onError: (error: unknown) => {
            toast.error(error instanceof Error ? error.message : "Failed to unfollow feed")
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
    return useQuery({
        queryKey: [RSS_QUERY_KEYS.ARTICLES, params],
        queryFn: () => ApiClient.rss.getArticles({
            feed_ids: params.feedIds,
            folder_id: params.folderId,
            is_read: params.isRead,
            is_read_later: params.isReadLater,
            is_favorite: params.isFavorite,
            feed_is_favorite: params.feedIsFavorite,
            published_since: params.publishedSince,
            published_until: params.publishedUntil,
            search_query: params.searchQuery,
            sort_by: params.sortBy,
            sort_order: params.sortOrder,
            page: params.page,
            size: params.size,
        }),
        ...options,
    })
}

export function useRecentlyReadArticles(
    params: { page?: number; size?: number } = {}
) {
    return useQuery({
        queryKey: [RSS_QUERY_KEYS.ARTICLES, "recently_read", params],
        queryFn: () => ApiClient.rss.getRecentlyReadArticles(params.page, params.size),
    })
}

export function useReadLaterArticles(
    params: { page?: number; size?: number } = {}
) {
    return useQuery({
        queryKey: [RSS_QUERY_KEYS.ARTICLES, "read_later", params],
        queryFn: () => ApiClient.rss.getReadLaterArticles(params.page, params.size),
    })
}

export function useUnreadCounts(folderId?: string) {
    return useQuery({
        queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS, folderId],
        queryFn: () => ApiClient.rss.getUnreadCounts(folderId),
    })
}

export function useArticle(articleId: string) {
    return useQuery({
        queryKey: [RSS_QUERY_KEYS.ARTICLE, articleId],
        queryFn: () => ApiClient.rss.getArticle(articleId),
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
        }) => ApiClient.rss.updateArticle(articleId, data),
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
