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
    SIDEBAR_DATA: "rss-sidebar-data",
    OPML_IMPORT_STATUS: "opml-import-status",
    REFRESH_STATUS: "refresh-status",
}

// Sidebar data hook - optimized single request for all sidebar data
export function useSidebarData() {
    return useQuery({
        queryKey: [RSS_QUERY_KEYS.SIDEBAR_DATA],
        queryFn: () => ApiClient.rss.getSidebarData(),
        staleTime: 5 * 60 * 1000, // 5 minutes - sidebar data doesn't change often
        refetchOnWindowFocus: false,
    })
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

// Legacy individual hooks - kept for backward compatibility and specific use cases
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
        onMutate: async (newFolder) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.FOLDERS],
            })
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.SIDEBAR_DATA],
            })

            // Snapshot the previous value
            const previousFolders = queryClient.getQueryData([
                RSS_QUERY_KEYS.FOLDERS,
            ])
            const previousSidebarData = queryClient.getQueryData([
                RSS_QUERY_KEYS.SIDEBAR_DATA,
            ])

            // Optimistically update to the new value
            const optimisticFolder = {
                id: `temp-${Date.now()}`,
                name: newFolder.name,
                user_id: "",
                created_at: new Date().toISOString(),
            }

            queryClient.setQueryData([RSS_QUERY_KEYS.FOLDERS], (old: any) => {
                if (!old) return [optimisticFolder]
                return [...old, optimisticFolder]
            })

            // Also update sidebar data optimistically
            queryClient.setQueryData(
                [RSS_QUERY_KEYS.SIDEBAR_DATA],
                (old: any) => {
                    if (!old) return old
                    return {
                        ...old,
                        folders: old.folders
                            ? [...old.folders, optimisticFolder]
                            : [optimisticFolder],
                    }
                }
            )

            // Return a context object with the snapshotted value
            return { previousFolders, previousSidebarData, optimisticFolder }
        },
        onError: (err, newFolder, context) => {
            // If the mutation fails, use the context returned from onMutate to roll back
            if (context?.previousFolders) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.FOLDERS],
                    context.previousFolders
                )
            }
            if (context?.previousSidebarData) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.SIDEBAR_DATA],
                    context.previousSidebarData
                )
            }
            toast.error("Failed to create folder")
        },
        onSuccess: (data, variables, context) => {
            toast.success("Folder created successfully")
        },
        onSettled: () => {
            // Only invalidate specific queries, don't remove cache to avoid skeleton reloading
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.FOLDERS],
            })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.SIDEBAR_DATA],
            })
        },
    })
}

export function useUpdateFolder() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ folderId, name }: { folderId: string; name: string }) =>
            ApiClient.rss.updateFolder(folderId, { name }),
        onMutate: async ({ folderId, name }) => {
            // Cancel any outgoing refetches to prevent conflicts
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.FOLDERS],
            })
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.SIDEBAR_DATA],
            })

            // Snapshot the previous values
            const previousFolders = queryClient.getQueryData([
                RSS_QUERY_KEYS.FOLDERS,
            ])
            const previousSidebarData = queryClient.getQueryData([
                RSS_QUERY_KEYS.SIDEBAR_DATA,
            ])

            // Optimistically update the folder name in folders cache
            queryClient.setQueryData([RSS_QUERY_KEYS.FOLDERS], (old: any) => {
                if (!old) return old
                return old.map((folder: any) =>
                    folder.id === folderId ? { ...folder, name } : folder
                )
            })

            // Optimistically update the folder name in sidebar data
            queryClient.setQueryData(
                [RSS_QUERY_KEYS.SIDEBAR_DATA],
                (old: any) => {
                    if (!old) return old
                    return {
                        ...old,
                        folders: old.folders
                            ? old.folders.map((folder: any) =>
                                  folder.id === folderId
                                      ? { ...folder, name }
                                      : folder
                              )
                            : [],
                    }
                }
            )

            return { previousFolders, previousSidebarData, folderId, name }
        },
        onError: (error: unknown, variables, context) => {
            // Rollback on error
            if (context?.previousFolders) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.FOLDERS],
                    context.previousFolders
                )
            }
            if (context?.previousSidebarData) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.SIDEBAR_DATA],
                    context.previousSidebarData
                )
            }
            toast.error("Failed to rename folder")
        },
        onSuccess: () => {
            toast.success("Folder renamed successfully")
        },
    })
}

export function useDeleteFolder() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (folderId: string) => {
            const response = await ApiClient.rss.deleteFolder(folderId)
            return response
        },
        onMutate: async (folderId) => {
            // Cancel any outgoing refetches to prevent conflicts
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.FOLDERS],
            })
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.SIDEBAR_DATA],
            })
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.FEEDS],
            })

            // Snapshot the previous values
            const previousFolders = queryClient.getQueryData([
                RSS_QUERY_KEYS.FOLDERS,
            ])
            const previousSidebarData = queryClient.getQueryData([
                RSS_QUERY_KEYS.SIDEBAR_DATA,
            ])
            const previousFeeds = queryClient.getQueryData([
                RSS_QUERY_KEYS.FEEDS,
            ])

            // Optimistically remove the folder from all caches
            queryClient.setQueryData([RSS_QUERY_KEYS.FOLDERS], (old: any) => {
                if (!old) return []
                return old.filter((folder: any) => folder.id !== folderId)
            })

            // Remove folder and its feeds from sidebar data
            queryClient.setQueryData(
                [RSS_QUERY_KEYS.SIDEBAR_DATA],
                (old: any) => {
                    if (!old) return old
                    return {
                        ...old,
                        folders: old.folders
                            ? old.folders.filter(
                                  (folder: any) => folder.id !== folderId
                              )
                            : [],
                        feeds: old.feeds
                            ? old.feeds.filter(
                                  (feed: any) => feed.folder_id !== folderId
                              )
                            : [],
                    }
                }
            )

            // Remove feeds from the folder from feeds cache
            queryClient.setQueryData([RSS_QUERY_KEYS.FEEDS], (old: any) => {
                if (!old) return []
                return old.filter((feed: any) => feed.folder_id !== folderId)
            })

            return {
                previousFolders,
                previousSidebarData,
                previousFeeds,
                folderId,
            }
        },
        onError: (error: unknown, folderId, context) => {
            // Rollback on error
            if (context?.previousFolders) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.FOLDERS],
                    context.previousFolders
                )
            }
            if (context?.previousSidebarData) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.SIDEBAR_DATA],
                    context.previousSidebarData
                )
            }
            if (context?.previousFeeds) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.FEEDS],
                    context.previousFeeds
                )
            }
            toast.error("Failed to delete folder")
        },
        onSuccess: () => {
            toast.success("Folder deleted successfully")
        },
        // Don't invalidate queries to avoid skeleton reloading - optimistic updates handle the UI
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
        queryFn: () =>
            ApiClient.rss.getFeeds({
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
        onMutate: async (newFeed) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.FEEDS],
            })
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.SIDEBAR_DATA],
            })

            // Snapshot the previous value
            const previousFeeds = queryClient.getQueryData([
                RSS_QUERY_KEYS.FEEDS,
            ])
            const previousSidebarData = queryClient.getQueryData([
                RSS_QUERY_KEYS.SIDEBAR_DATA,
            ])

            // Optimistically update to the new value
            const optimisticFeed = {
                id: `temp-${Date.now()}`,
                title: "Loading...",
                url: newFeed.url,
                description: "",
                image_url: null,
                folder_id: newFeed.folder_id || null,
                folder_name: null,
                is_favorite: false,
                last_fetched_at: null,
                tags: [],
                unread_count: 0,
                fetch_error_count: 0,
                last_error_message: null,
                last_article_published_at: null,
            }

            queryClient.setQueryData([RSS_QUERY_KEYS.FEEDS], (old: any) => {
                if (!old) return [optimisticFeed]
                return [...old, optimisticFeed]
            })

            // Also update sidebar data optimistically
            queryClient.setQueryData(
                [RSS_QUERY_KEYS.SIDEBAR_DATA],
                (old: any) => {
                    if (!old) return old
                    return {
                        ...old,
                        feeds: old.feeds
                            ? [...old.feeds, optimisticFeed]
                            : [optimisticFeed],
                    }
                }
            )

            // Return a context object with the snapshotted value
            return { previousFeeds, previousSidebarData, optimisticFeed }
        },
        onError: (err, newFeed, context) => {
            // If the mutation fails, use the context returned from onMutate to roll back
            if (context?.previousFeeds) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.FEEDS],
                    context.previousFeeds
                )
            }
            if (context?.previousSidebarData) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.SIDEBAR_DATA],
                    context.previousSidebarData
                )
            }
            toast.error("Failed to add feed")
        },
        onSuccess: (data, variables, context) => {
            toast.success("Feed added successfully")
        },
        onSettled: () => {
            // Only invalidate specific queries, don't remove cache to avoid skeleton reloading
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLES],
            })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
            })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.SIDEBAR_DATA],
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
        onMutate: async ({ feedId, data }) => {
            // Cancel any outgoing refetches to prevent conflicts
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.FEEDS],
            })
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.SIDEBAR_DATA],
            })
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.FEEDS, feedId],
            })

            // Snapshot the previous values
            const previousFeeds = queryClient.getQueryData([
                RSS_QUERY_KEYS.FEEDS,
            ])
            const previousSidebarData = queryClient.getQueryData([
                RSS_QUERY_KEYS.SIDEBAR_DATA,
            ])
            const previousFeed = queryClient.getQueryData([
                RSS_QUERY_KEYS.FEEDS,
                feedId,
            ])

            // Optimistically update the feed in feeds cache
            queryClient.setQueryData([RSS_QUERY_KEYS.FEEDS], (old: any) => {
                if (!old) return old
                return old.map((feed: any) =>
                    feed.id === feedId ? { ...feed, ...data } : feed
                )
            })

            // Optimistically update the feed in sidebar data
            queryClient.setQueryData(
                [RSS_QUERY_KEYS.SIDEBAR_DATA],
                (old: any) => {
                    if (!old) return old
                    return {
                        ...old,
                        feeds: old.feeds
                            ? old.feeds.map((feed: any) =>
                                  feed.id === feedId
                                      ? { ...feed, ...data }
                                      : feed
                              )
                            : [],
                    }
                }
            )

            // Optimistically update individual feed cache
            queryClient.setQueryData(
                [RSS_QUERY_KEYS.FEEDS, feedId],
                (old: any) => {
                    if (!old) return old
                    return { ...old, ...data }
                }
            )

            return {
                previousFeeds,
                previousSidebarData,
                previousFeed,
                feedId,
                data,
            }
        },
        onError: (error: unknown, variables, context) => {
            // Rollback on error
            if (context?.previousFeeds) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.FEEDS],
                    context.previousFeeds
                )
            }
            if (context?.previousSidebarData) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.SIDEBAR_DATA],
                    context.previousSidebarData
                )
            }
            if (context?.previousFeed) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.FEEDS, context.feedId],
                    context.previousFeed
                )
            }
            toast.error("Failed to update feed")
        },
        onSuccess: (_, { data }) => {
            if (data.title) {
                toast.success("Feed renamed successfully")
            } else {
                toast.success("Feed updated successfully")
            }
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
            return null
        },
        onMutate: async (feedId) => {
            // Cancel any outgoing refetches to prevent conflicts
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.FEEDS],
            })
            await queryClient.cancelQueries({
                queryKey: [RSS_QUERY_KEYS.SIDEBAR_DATA],
            })

            // Snapshot the previous values
            const previousFeeds = queryClient.getQueryData([
                RSS_QUERY_KEYS.FEEDS,
            ])
            const previousSidebarData = queryClient.getQueryData([
                RSS_QUERY_KEYS.SIDEBAR_DATA,
            ])

            // Optimistically remove the feed from feeds list
            queryClient.setQueryData([RSS_QUERY_KEYS.FEEDS], (old: any) => {
                if (!old) return []
                return old.filter((feed: any) => feed.id !== feedId)
            })

            // Optimistically remove the feed from sidebar data
            queryClient.setQueryData(
                [RSS_QUERY_KEYS.SIDEBAR_DATA],
                (old: any) => {
                    if (!old) return old
                    return {
                        ...old,
                        feeds: old.feeds
                            ? old.feeds.filter(
                                  (feed: any) => feed.id !== feedId
                              )
                            : [],
                    }
                }
            )

            return { previousFeeds, previousSidebarData, feedId }
        },
        onError: (error: unknown, feedId, context) => {
            // Rollback on error
            if (context?.previousFeeds) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.FEEDS],
                    context.previousFeeds
                )
            }
            if (context?.previousSidebarData) {
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.SIDEBAR_DATA],
                    context.previousSidebarData
                )
            }
            toast.error("Failed to remove feed")
        },
        onSuccess: () => {
            toast.success("Feed removed successfully")
        },
        // Don't invalidate queries to avoid skeleton reloading - optimistic updates handle the UI
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
        queryFn: () =>
            ApiClient.rss.getArticles({
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
        queryFn: () =>
            ApiClient.rss.getRecentlyReadArticles(params.page, params.size),
    })
}

export function useReadLaterArticles(
    params: { page?: number; size?: number } = {}
) {
    return useQuery({
        queryKey: [RSS_QUERY_KEYS.ARTICLES, "read_later", params],
        queryFn: () =>
            ApiClient.rss.getReadLaterArticles(params.page, params.size),
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
