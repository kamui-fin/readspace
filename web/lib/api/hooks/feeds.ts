import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ApiClient } from "../client"

// Types based on API responses
type Folder = {
    id: string
    name: string
    user_id: string
    created_at: string
}

type Feed = {
    id: string
    title: string
    url: string
    description: string
    image_url: string | null
    folder_id: string | null
    folder_name: string | null
    is_favorite: boolean
    last_fetched_at: string | null
    tags: { id: string, name: string }[]
    unread_count: number
}

// Corresponds to FeedBasicInfo in rss_schemas.py
export type FeedBasicInfo = {
    id: string; // Changed from UUID to string for frontend consistency, assuming conversion happens
    title: string | null;
    url: string; // Changed from HttpUrl to string
    image_url: string | null; // Changed from HttpUrl to string
};

// Export the Article type
export type Article = {
    id: string;
    feed_id: string;
    // feed_title: string; // This will now come from the nested feed object if needed
    title: string;
    link: string; // Changed from url to link, matches backend model
    description: string | null; // Made nullable to match schema (Optional[str])
    content: string | null;     // Made nullable to match schema (Optional[str])
    image_url: string | null;
    author: string | null; // Kept, though not explicitly in ArticleBase, might be populated
    published_at: string | null; // Made nullable to match schema (Optional[datetime])
    is_read: boolean;
    read_at: string | null;
    is_read_later: boolean;
    is_favorite: boolean;
    created_at: string;
    updated_at: string; // Added
    user_id: string;    // Added
    guid: string;       // Added
    estimated_read_time_minutes: number | null; // Added, made nullable
    custom_metadata: any | null; // Added (JSONB maps to any)
    feed?: FeedBasicInfo; // Added nested feed object, optional to match schema
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
}

// Folder hooks
export function useFolders() {
    return useQuery({
        queryKey: [RSS_QUERY_KEYS.FOLDERS],
        queryFn: () => ApiClient.get<Folder[]>("/rss/folders"),
    })
}

export function useCreateFolder() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (folder: { name: string }) =>
            ApiClient.post<Folder>("/rss/folders", folder),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FOLDERS] })
        },
    })
}

export function useUpdateFolder() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ folderId, name }: { folderId: string; name: string }) =>
            ApiClient.put<Folder>(`/rss/folders/${folderId}`, { name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FOLDERS] })
        },
    })
}

export function useDeleteFolder() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (folderId: string) =>
            ApiClient.rss.deleteFolder(folderId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FOLDERS] })
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] })
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] })
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS] })
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
    if (params?.tagNames) params.tagNames.forEach(tag => queryParams.append("tag_names", tag))
    if (params?.isFavorite !== undefined) queryParams.append("is_favorite", params.isFavorite.toString())
    if (params?.searchQuery) queryParams.append("search_query", params.searchQuery)

    const queryString = queryParams.toString()
    const url = `/rss/feeds${queryString ? `?${queryString}` : ''}`

    return useQuery({
        queryKey: [RSS_QUERY_KEYS.FEEDS, params],
        queryFn: () => ApiClient.get<Feed[]>(url),
    })
}

export function useFeed(feedId: string) {
    return useQuery({
        queryKey: [RSS_QUERY_KEYS.FEEDS, feedId],
        queryFn: () => ApiClient.get<Feed>(`/rss/feeds/${feedId}`),
        enabled: !!feedId,
    })
}

export function useCreateFeed() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (feed: { url: string; folder_id?: string; tag_ids?: string[] }) =>
            ApiClient.post<Feed>("/rss/feeds", feed),
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
            data
        }: {
            feedId: string;
            data: {
                folder_id?: string;
                tag_ids?: string[];
                is_favorite?: boolean;
                title?: string;
            }
        }) => ApiClient.rss.updateFeed(feedId, data),
        onSuccess: (_, { feedId }) => {
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] })
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS, feedId] })
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] })
        },
    })
}

export function useRefreshFeed() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({
            feedId,
            forceRefetch = false
        }: {
            feedId: string;
            forceRefetch?: boolean
        }) => {
            const queryParams = new URLSearchParams()
            if (forceRefetch) queryParams.append("force_refetch", "true")
            return ApiClient.post<Feed>(
                `/rss/feeds/${feedId}/refresh${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
            )
        },
        onSuccess: (_, { feedId }) => {
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] })
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS, feedId] })
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] })
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS] })
        },
    })
}

export function useDeleteFeed() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (feedId: string) =>
            ApiClient.rss.deleteFeed(feedId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] })
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] })
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS] })
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
        keepPreviousData?: boolean,
        refetchOnMount?: boolean | "always",
        refetchOnWindowFocus?: boolean | "always",
        staleTime?: number
    }
) {
    // Build query string from params
    const queryParams = new URLSearchParams()
    if (params.feedIds) params.feedIds.forEach(id => queryParams.append("feed_ids", id))
    if (params.folderId) queryParams.append("folder_id", params.folderId)
    if (params.isRead !== undefined) queryParams.append("is_read", params.isRead.toString())
    if (params.isReadLater !== undefined) queryParams.append("is_read_later", params.isReadLater.toString())
    if (params.isFavorite !== undefined) queryParams.append("is_favorite", params.isFavorite.toString())
    if (params.feedIsFavorite !== undefined) queryParams.append("feed_is_favorite", params.feedIsFavorite.toString())
    if (params.publishedSince) queryParams.append("published_since", params.publishedSince)
    if (params.publishedUntil) queryParams.append("published_until", params.publishedUntil)
    if (params.searchQuery) queryParams.append("search_query", params.searchQuery)
    if (params.sortBy) queryParams.append("sort_by", params.sortBy)
    if (params.sortOrder) queryParams.append("sort_order", params.sortOrder)
    if (params.page) queryParams.append("page", params.page.toString())
    if (params.size) queryParams.append("size", params.size.toString())

    const queryString = queryParams.toString()
    const url = `/rss/articles${queryString ? `?${queryString}` : ''}`

    return useQuery({
        queryKey: [RSS_QUERY_KEYS.ARTICLES, params],
        queryFn: () => ApiClient.get<PaginatedResponse<Article>>(url),
        ...options
    })
}

export function useRecentlyReadArticles(params: { page?: number, size?: number } = {}) {
    const queryParams = new URLSearchParams()
    if (params.page) queryParams.append("page", params.page.toString())
    if (params.size) queryParams.append("size", params.size.toString())

    const queryString = queryParams.toString()
    const url = `/rss/articles/recently_read${queryString ? `?${queryString}` : ''}`

    return useQuery({
        queryKey: [RSS_QUERY_KEYS.ARTICLES, "recently_read", params],
        queryFn: () => ApiClient.get<PaginatedResponse<Article>>(url),
    })
}

export function useReadLaterArticles(params: { page?: number, size?: number } = {}) {
    const queryParams = new URLSearchParams()
    if (params.page) queryParams.append("page", params.page.toString())
    if (params.size) queryParams.append("size", params.size.toString())

    const queryString = queryParams.toString()
    const url = `/rss/articles/read_later${queryString ? `?${queryString}` : ''}`

    return useQuery({
        queryKey: [RSS_QUERY_KEYS.ARTICLES, "read_later", params],
        queryFn: () => ApiClient.get<PaginatedResponse<Article>>(url),
    })
}

export function useUnreadCounts(folderId?: string) {
    const queryParams = new URLSearchParams()
    if (folderId) queryParams.append("folder_id", folderId)

    const queryString = queryParams.toString()
    const url = `/rss/articles/unread_counts${queryString ? `?${queryString}` : ''}`

    return useQuery({
        queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS, folderId],
        queryFn: () => ApiClient.get<{
            total_unread: number;
            unread_by_folder?: { folder_id: string; name: string; unread_count: number }[];
            folder_unread?: { folder_id: string; name: string; count: number };
        }>(url),
    })
}

export function useArticle(articleId: string) {
    return useQuery({
        queryKey: [RSS_QUERY_KEYS.ARTICLE, articleId],
        queryFn: () => ApiClient.get<Article>(`/rss/articles/${articleId}`),
        enabled: !!articleId,
    })
}

export function useUpdateArticle() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({
            articleId,
            data
        }: {
            articleId: string;
            data: {
                is_read?: boolean;
                read_at?: string;
                is_read_later?: boolean;
                is_favorite?: boolean;
            }
        }) => ApiClient.put<Article>(`/rss/articles/${articleId}`, data),
        onSuccess: (_, { articleId }) => {
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLE, articleId] })
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] })
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS] })
        },
    })
}

export function useBulkUpdateArticles() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({
            articleIds,
            action
        }: {
            articleIds: string[];
            action: "mark_as_read" | "mark_as_unread" | "mark_as_read_later" | "unmark_as_read_later" | "mark_as_favorite" | "unmark_as_favorite";
        }) => ApiClient.post<{ affected_articles: number }>(`/rss/articles/bulk_update`, {
            article_ids: articleIds,
            action
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] })
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS] })
        },
    })
}

// Hook for marking all articles in a feed as read
export const useMarkFeedAsRead = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (feedId: string) => ApiClient.rss.markFeedAsRead(feedId),
        onSuccess: async () => {
            // Invalidate queries that might be affected
            await queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] });
            await queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS] });
        }
    });
};

// Hook for marking all articles in a folder as read
export const useMarkFolderAsRead = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (folderId: string) => ApiClient.rss.markFolderAsRead(folderId),
        onSuccess: async () => {
            // Invalidate queries that might be affected
            await queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] });
            await queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS] });
        }
    });
}; 