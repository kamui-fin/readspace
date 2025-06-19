import { env } from "@/env"
import { getSession } from "@/lib/auth/supabase"
import { createClient } from "@/lib/supabase/server"

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
        const { data: { session } } = await supabase.auth.getSession()
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
    private static baseUrl = env.NEXT_PUBLIC_API_BASE_URL || "http://0.0.0.0:8008"

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
        const { "Content-Type": _, ...uploadHeaders } = headers as Record<string, string>
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
        getUserBooks: () => this.get("/api/books/"),
        getBook: (id: string) => this.get(`/api/books/${id}`),
        createBook: (data: any) => this.post("/api/books/", data),
        updateBook: (id: string, data: any) => this.put(`/api/books/${id}`, data),
        deleteBook: (id: string) => this.delete(`/api/books/${id}`),
    }

    // Highlight endpoints
    static highlights = {
        getBookHighlights: (bookId: string) =>
            this.get(`/api/books/${bookId}/highlights`),
        createHighlight: (bookId: string, data: any) =>
            this.post(`/api/books/${bookId}/highlights`, data),
        updateHighlight: (bookId: string, highlightId: string, data: any) =>
            this.put(`/api/books/${bookId}/highlights/${highlightId}`, data),
        deleteHighlight: (bookId: string, highlightId: string) =>
            this.delete(`/api/books/${bookId}/highlights/${highlightId}`),
    }

    // RSS endpoints
    static rss = {
        // Folders
        getFolders: () => this.get("/api/rss/folders"),
        getFolder: (id: string) => this.get(`/api/rss/folders/${id}`),
        createFolder: (data: { name: string }) => this.post("/api/rss/folders", data),
        updateFolder: (id: string, data: { name: string }) => this.put(`/api/rss/folders/${id}`, data),
        deleteFolder: (id: string) => this.delete(`/api/rss/folders/${id}`),

        // Feeds
        getFeeds: (params?: {
            folder_id?: string;
            tag_names?: string[];
            is_favorite?: boolean;
            search_query?: string;
        }) => {
            const queryParams = new URLSearchParams();
            if (params?.folder_id) queryParams.append("folder_id", params.folder_id);
            if (params?.tag_names) params.tag_names.forEach(tag => queryParams.append("tag_names", tag));
            if (params?.is_favorite !== undefined) queryParams.append("is_favorite", params.is_favorite.toString());
            if (params?.search_query) queryParams.append("search_query", params.search_query);

            const queryString = queryParams.toString();
            return this.get(`/api/rss/feeds${queryString ? `?${queryString}` : ''}`);
        },
        getFeed: (id: string) => this.get(`/api/rss/feeds/${id}`),
        createFeed: (data: { url: string; folder_id?: string; tag_ids?: string[] }) =>
            this.post("/api/rss/feeds", data),
        updateFeed: (id: string, data: {
            folder_id?: string;
            tag_ids?: string[];
            is_favorite?: boolean;
            title?: string;
        }) => this.put(`/api/rss/feeds/${id}`, data),
        refreshFeed: (id: string, forceRefetch: boolean = false) => {
            const queryParams = new URLSearchParams();
            if (forceRefetch) queryParams.append("force_refetch", "true");
            return this.post(`/api/rss/feeds/${id}/refresh${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
        },
        refreshFolderFeeds: (folderId: string) => this.post(`/api/rss/feeds/refresh_folder/${folderId}`),
        refreshAllFeeds: () => this.post("/api/rss/feeds/refresh_all"),
        getRefreshStatus: (taskId: string) => this.get(`/api/rss/feeds/refresh_status/${taskId}`),
        deleteFeed: (id: string) => this.delete(`/api/rss/feeds/${id}`),

        // Articles
        getArticles: (params: {
            feed_ids?: string[];
            folder_id?: string;
            is_read?: boolean;
            is_read_later?: boolean;
            is_favorite?: boolean;
            feed_is_favorite?: boolean;
            published_since?: string;
            published_until?: string;
            search_query?: string;
            sort_by?: string;
            sort_order?: string;
            page?: number;
            size?: number;
        }) => {
            const queryParams = new URLSearchParams();
            if (params.feed_ids) params.feed_ids.forEach(id => queryParams.append("feed_ids", id));
            if (params.folder_id) queryParams.append("folder_id", params.folder_id);
            if (params.is_read !== undefined) queryParams.append("is_read", params.is_read.toString());
            if (params.is_read_later !== undefined) queryParams.append("is_read_later", params.is_read_later.toString());
            if (params.is_favorite !== undefined) queryParams.append("is_favorite", params.is_favorite.toString());
            if (params.feed_is_favorite !== undefined) queryParams.append("feed_is_favorite", params.feed_is_favorite.toString());
            if (params.published_since) queryParams.append("published_since", params.published_since);
            if (params.published_until) queryParams.append("published_until", params.published_until);
            if (params.search_query) queryParams.append("search_query", params.search_query);
            if (params.sort_by) queryParams.append("sort_by", params.sort_by);
            if (params.sort_order) queryParams.append("sort_order", params.sort_order);
            if (params.page) queryParams.append("page", params.page.toString());
            if (params.size) queryParams.append("size", params.size.toString());

            const queryString = queryParams.toString();
            return this.get(`/api/rss/articles${queryString ? `?${queryString}` : ''}`);
        },
        getRecentlyReadArticles: (page?: number, size?: number) => {
            const queryParams = new URLSearchParams();
            if (page) queryParams.append("page", page.toString());
            if (size) queryParams.append("size", size.toString());

            const queryString = queryParams.toString();
            return this.get(`/api/rss/articles/recently_read${queryString ? `?${queryString}` : ''}`);
        },
        getReadLaterArticles: (page?: number, size?: number) => {
            const queryParams = new URLSearchParams();
            if (page) queryParams.append("page", page.toString());
            if (size) queryParams.append("size", size.toString());

            const queryString = queryParams.toString();
            return this.get(`/api/rss/articles/read_later${queryString ? `?${queryString}` : ''}`);
        },
        getUnreadCounts: (folderId?: string) => {
            const queryParams = new URLSearchParams();
            if (folderId) queryParams.append("folder_id", folderId);

            const queryString = queryParams.toString();
            return this.get(`/api/rss/articles/unread_counts${queryString ? `?${queryString}` : ''}`);
        },
        getArticle: (id: string) => this.get(`/api/rss/articles/${id}`),
        updateArticle: (id: string, data: {
            is_read?: boolean;
            read_at?: string;
            is_read_later?: boolean;
            is_favorite?: boolean;
        }) => this.put(`/api/rss/articles/${id}`, data),
        bulkUpdateArticles: (articleIds: string[], action: string) =>
            this.post(`/api/rss/articles/bulk_update`, { article_ids: articleIds, action }),
        markFeedAsRead: (feedId: string) =>
            this.post<{ affected_articles: number }>(`/api/rss/articles/feed/${feedId}/mark-all-as-read`),
        markFolderAsRead: (folderId: string) =>
            this.post<{ affected_articles: number }>(`/api/rss/articles/folder/${folderId}/mark-all-as-read`),
    }
}