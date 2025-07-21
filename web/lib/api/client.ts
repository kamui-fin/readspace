import { env } from "@/env"
import { getSession } from "@/lib/auth/supabase"
import { createClient } from "@/lib/supabase/server"
import { UserBookLibrary, Highlight } from "@/types/api"

export class ApiError extends Error {
    constructor(
        public status: number,
        message: string
    ) {
        super(message)
        this.name = "ApiError"
    }
}

// Helper function to get auth headers
async function getAuthHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
        "Content-Type": "application/json",
    }

    try {
        // Try server-side auth first
        const supabase = await createClient()
        const {
            data: { session },
        } = await supabase.auth.getSession()
        if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`
            return headers
        }
    } catch {
        // If server-side auth fails, try client-side auth
        const session = await getSession()
        if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`
        }
    }

    return headers
}

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error = await response
            .json()
            .catch(() => ({ message: "An error occurred" }))
        throw new ApiError(
            response.status,
            error.message || "An error occurred"
        )
    }
    return response.json()
}

export class ApiClient {
    private static baseUrl =
        env.NEXT_PUBLIC_API_BASE_URL || "http://0.0.0.0:8008"

    static async fetch<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        try {
            const headers = await getAuthHeaders()
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: {
                    ...headers,
                    ...options.headers,
                },
                cache: "no-store", // Disable caching for authenticated requests
            })

            return handleResponse<T>(response)
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                throw new Error("Authentication required")
            }
            throw error
        }
    }

    static async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
        return this.fetch<T>(endpoint, { ...options, method: "GET" })
    }

    static async post<T>(
        endpoint: string,
        data?: any,
        options?: RequestInit
    ): Promise<T> {
        return this.fetch<T>(endpoint, {
            ...options,
            method: "POST",
            body: data ? JSON.stringify(data) : undefined,
        })
    }

    static async put<T>(
        endpoint: string,
        data?: any,
        options?: RequestInit
    ): Promise<T> {
        return this.fetch<T>(endpoint, {
            ...options,
            method: "PUT",
            body: data ? JSON.stringify(data) : undefined,
        })
    }

    static async delete<T>(
        endpoint: string,
        options?: RequestInit
    ): Promise<T> {
        return this.fetch<T>(endpoint, { ...options, method: "DELETE" })
    }

    static async uploadFile(
        endpoint: string,
        formData: FormData,
        signal?: AbortSignal
    ): Promise<any> {
        const headers = await getAuthHeaders()
        // Remove Content-Type header for form data to let the browser set it with the boundary
        const { "Content-Type": _, ...uploadHeaders } = headers as Record<
            string,
            string
        >
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: "POST",
            body: formData,
            signal,
            headers: uploadHeaders,
        })

        return handleResponse(response)
    }

    // Book endpoints
    static books = {
        getUserBooks: (): Promise<UserBookLibrary[]> => this.get("/api/books/"),
        getBook: (id: string): Promise<UserBookLibrary> =>
            this.get(`/api/books/${id}`),
        createBook: (data: any): Promise<UserBookLibrary> =>
            this.post("/api/books/", data),
        updateBook: (id: string, data: any): Promise<UserBookLibrary> =>
            this.put(`/api/books/${id}`, data),
        updateBookProgress: (id: string, data: any): Promise<UserBookLibrary> =>
            this.put(`/api/books/${id}/progress`, data),
        deleteBook: (id: string): Promise<void> =>
            this.delete(`/api/books/${id}`),
        deleteBookMetadata: (metadataId: string): Promise<void> =>
            this.delete(`/api/books/metadata/${metadataId}`),
    }

    // Highlight endpoints
    static highlights = {
        getBookHighlights: (bookId: string): Promise<Highlight[]> =>
            this.get(`/api/highlights/book/${bookId}`),
        createHighlight: (data: any): Promise<Highlight> =>
            this.post("/api/highlights/", data),
        updateHighlight: (highlightId: string, data: any): Promise<Highlight> =>
            this.put(`/api/highlights/${highlightId}`, data),
        updateHighlightNote: (
            highlightId: string,
            note: string
        ): Promise<Highlight> =>
            this.put(`/api/highlights/${highlightId}/note`, { note }),
        deleteHighlight: (highlightId: string): Promise<void> =>
            this.delete(`/api/highlights/${highlightId}`),
        deleteHighlightByText: (text: string): Promise<void> =>
            this.delete(`/api/highlights/text/${encodeURIComponent(text)}`),
    }

    // RSS endpoints
    static rss = {
        // Folders
        getFolders: () =>
            this.get<
                {
                    id: string
                    name: string
                    user_id: string
                    created_at: string
                }[]
            >("/api/rss/folders/"),
        getFolder: (id: string) =>
            this.get<{
                id: string
                name: string
                user_id: string
                created_at: string
            }>(`/api/rss/folders/${id}`),
        createFolder: (data: { name: string }) =>
            this.post<{
                id: string
                name: string
                user_id: string
                created_at: string
            }>("/api/rss/folders/", data),
        updateFolder: (id: string, data: { name: string }) =>
            this.put<{
                id: string
                name: string
                user_id: string
                created_at: string
            }>(`/api/rss/folders/${id}`, data),
        deleteFolder: (id: string) => this.delete(`/api/rss/folders/${id}`),

        // OPML Import
        importOPML: (formData: FormData) =>
            this.uploadFile("/api/rss/opml/import", formData),
        getImportTaskStatus: (taskId: string) =>
            this.get<{
                task_id: string
                status: string
                progress?: number
                completed?: number
                total?: number
                feeds_imported?: number
                feeds_failed?: number
            }>(`/api/rss/opml/import/status/${taskId}`),

        // Feeds
        getSidebarData: () =>
            this.get<{
                feeds: Array<{
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
                }>
                folders: Array<{
                    id: string
                    name: string
                    user_id: string
                    created_at: string
                }>
                unread_counts: {
                    total_unread?: number
                    unread_by_folder?: Array<{
                        folder_id: string
                        unread_count: number
                    }>
                }
            }>("/api/rss/feeds/sidebar-data"),
        getFeeds: (params?: {
            folder_id?: string
            tag_names?: string[]
            is_favorite?: boolean
            search_query?: string
        }) => {
            const queryParams = new URLSearchParams()
            if (params?.folder_id)
                queryParams.append("folder_id", params.folder_id)
            if (params?.tag_names)
                params.tag_names.forEach((tag) =>
                    queryParams.append("tag_names", tag)
                )
            if (params?.is_favorite !== undefined)
                queryParams.append("is_favorite", params.is_favorite.toString())
            if (params?.search_query)
                queryParams.append("search_query", params.search_query)

            const queryString = queryParams.toString()
            return this.get<
                {
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
                }[]
            >(`/api/rss/feeds/${queryString ? `?${queryString}` : ""}`)
        },
        getFeed: (id: string) =>
            this.get<{
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
            }>(`/api/rss/feeds/${id}`),
        createFeed: (data: {
            url: string
            folder_id?: string
            tag_ids?: string[]
        }) =>
            this.post<{
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
            }>("/api/rss/feeds/", data),
        updateFeed: (
            id: string,
            data: {
                folder_id?: string
                tag_ids?: string[]
                is_favorite?: boolean
                title?: string
            }
        ) =>
            this.put<{
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
            }>(`/api/rss/feeds/${id}`, data),
        refreshFeed: (id: string, forceRefetch: boolean = false) => {
            const queryParams = new URLSearchParams()
            if (forceRefetch) queryParams.append("force_refetch", "true")
            return this.post<{ task_id: string; status: string }>(
                `/api/rss/feeds/${id}/refresh${queryParams.toString() ? `?${queryParams.toString()}` : ""}`
            )
        },
        refreshFolderFeeds: (folderId: string) =>
            this.post<{ task_id: string; status: string }>(
                `/api/rss/feeds/refresh_folder/${folderId}`
            ),
        refreshAllFeeds: () =>
            this.post<{ task_id: string; status: string }>(
                "/api/rss/feeds/refresh_all"
            ),
        getRefreshStatus: (taskId: string) =>
            this.get<{
                task_id: string
                status: string
                progress?: number
                completed?: number
                total?: number
            }>(`/api/rss/feeds/refresh_status/${taskId}`),
        deleteFeed: (id: string) => this.delete(`/api/rss/feeds/${id}`),

        // Articles
        getArticles: (params: {
            feed_ids?: string[]
            folder_id?: string
            is_read?: boolean
            is_read_later?: boolean
            is_favorite?: boolean
            feed_is_favorite?: boolean
            published_since?: string
            published_until?: string
            search_query?: string
            sort_by?: string
            sort_order?: string
            page?: number
            size?: number
        }) => {
            const queryParams = new URLSearchParams()
            if (params.feed_ids)
                params.feed_ids.forEach((id) =>
                    queryParams.append("feed_ids", id)
                )
            if (params.folder_id)
                queryParams.append("folder_id", params.folder_id)
            if (params.is_read !== undefined)
                queryParams.append("is_read", params.is_read.toString())
            if (params.is_read_later !== undefined)
                queryParams.append(
                    "is_read_later",
                    params.is_read_later.toString()
                )
            if (params.is_favorite !== undefined)
                queryParams.append("is_favorite", params.is_favorite.toString())
            if (params.feed_is_favorite !== undefined)
                queryParams.append(
                    "feed_is_favorite",
                    params.feed_is_favorite.toString()
                )
            if (params.published_since)
                queryParams.append("published_since", params.published_since)
            if (params.published_until)
                queryParams.append("published_until", params.published_until)
            if (params.search_query)
                queryParams.append("search_query", params.search_query)
            if (params.sort_by) queryParams.append("sort_by", params.sort_by)
            if (params.sort_order)
                queryParams.append("sort_order", params.sort_order)
            if (params.page) queryParams.append("page", params.page.toString())
            if (params.size) queryParams.append("size", params.size.toString())

            const queryString = queryParams.toString()
            return this.get<{
                articles: Array<{
                    id: string
                    title: string
                    url: string
                    content: string
                    published_at: string
                    author: string | null
                    is_read: boolean
                    is_read_later: boolean
                    is_favorite: boolean
                    read_at: string | null
                    feed_id: string
                    feed_title: string
                    feed_image_url: string | null
                }>
                total: number
                page: number
                size: number
                total_pages: number
            }>(`/api/rss/articles/${queryString ? `?${queryString}` : ""}`)
        },
        getRecentlyReadArticles: (page?: number, size?: number) => {
            const queryParams = new URLSearchParams()
            if (page) queryParams.append("page", page.toString())
            if (size) queryParams.append("size", size.toString())

            const queryString = queryParams.toString()
            return this.get<{
                articles: Array<{
                    id: string
                    title: string
                    url: string
                    content: string
                    published_at: string
                    author: string | null
                    is_read: boolean
                    is_read_later: boolean
                    is_favorite: boolean
                    read_at: string | null
                    feed_id: string
                    feed_title: string
                    feed_image_url: string | null
                }>
                total: number
                page: number
                size: number
                total_pages: number
            }>(
                `/api/rss/articles/recently_read${queryString ? `?${queryString}` : ""}`
            )
        },
        getReadLaterArticles: (page?: number, size?: number) => {
            const queryParams = new URLSearchParams()
            if (page) queryParams.append("page", page.toString())
            if (size) queryParams.append("size", size.toString())

            const queryString = queryParams.toString()
            return this.get<{
                articles: Array<{
                    id: string
                    title: string
                    url: string
                    content: string
                    published_at: string
                    author: string | null
                    is_read: boolean
                    is_read_later: boolean
                    is_favorite: boolean
                    read_at: string | null
                    feed_id: string
                    feed_title: string
                    feed_image_url: string | null
                }>
                total: number
                page: number
                size: number
                total_pages: number
            }>(
                `/api/rss/articles/read_later${queryString ? `?${queryString}` : ""}`
            )
        },
        getUnreadCounts: (folderId?: string) => {
            const queryParams = new URLSearchParams()
            if (folderId) queryParams.append("folder_id", folderId)

            const queryString = queryParams.toString()
            return this.get<{
                [feedId: string]: number
            }>(
                `/api/rss/articles/unread_counts${queryString ? `?${queryString}` : ""}`
            )
        },
        getArticle: (id: string) =>
            this.get<{
                id: string
                title: string
                url: string
                content: string
                published_at: string
                author: string | null
                is_read: boolean
                is_read_later: boolean
                is_favorite: boolean
                read_at: string | null
                feed_id: string
                feed_title: string
                feed_image_url: string | null
            }>(`/api/rss/articles/${id}`),
        updateArticle: (
            id: string,
            data: {
                is_read?: boolean
                read_at?: string
                is_read_later?: boolean
                is_favorite?: boolean
            }
        ) =>
            this.put<{
                id: string
                title: string
                url: string
                content: string
                published_at: string
                author: string | null
                is_read: boolean
                is_read_later: boolean
                is_favorite: boolean
                read_at: string | null
                feed_id: string
                feed_title: string
                feed_image_url: string | null
            }>(`/api/rss/articles/${id}`, data),
    }
}
