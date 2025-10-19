import type {
  BookMetadataCreate,
  Highlight,
  HighlightCreate,
  HighlightUpdate,
  UserBookLibrary,
  UserBookLibraryUpdate,
} from "./types/books";
import type {
  ActiveImportTask,
  ArticlesPaginatedResponse,
  DiscoverSearchResponse,
  Feed,
  Folder,
  ImportTaskStatus,
  OPMLImportResponse,
  SimilarFeedsResponse,
} from "./types/rss";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Type for auth token provider function
export type AuthTokenProvider = () => Promise<string | null>;

// Configuration interface for the API client
export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken: AuthTokenProvider;
}

// Helper function to get auth headers with configurable token provider
async function getAuthHeaders(
  getAuthToken: AuthTokenProvider,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const token = await getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  } catch (error) {
    console.warn("Failed to get auth token:", error);
  }

  return headers;
}

// Helper function to perform a request with automatic token refresh retry
async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  getAuthToken: AuthTokenProvider,
): Promise<T> {
  let response = await fetch(url, options);

  // If we get a 401, try refreshing the token and retry once
  if (response.status === 401) {
    console.log("Received 401, attempting token refresh and retry");

    try {
      // Get a fresh token (this should trigger a refresh in Supabase)
      const freshHeaders = await getAuthHeaders(getAuthToken);

      // Retry the request with fresh token
      response = await fetch(url, {
        ...options,
        headers: {
          ...freshHeaders,
          ...options.headers,
        },
      });
    } catch (retryError) {
      console.warn("Token refresh retry failed:", retryError);
      // Fall through to handle the original 401 response
    }
  }

  return handleResponse<T>(response);
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "An error occurred" }));

    let errorMessage: string;

    // Handle FastAPI validation errors (array of error objects)
    if (Array.isArray(error.detail)) {
      const validationErrors = error.detail;

      // Check for file size validation error
      const fileSizeError = validationErrors.find(
        (err: any) =>
          err.type === "less_than_equal" &&
          err.loc?.includes("file_size_bytes")
      );

      if (fileSizeError && fileSizeError.ctx?.le) {
        const maxSizeMB = (fileSizeError.ctx.le / (1024 * 1024)).toFixed(0);
        const actualSizeMB = fileSizeError.input
          ? (fileSizeError.input / (1024 * 1024)).toFixed(1)
          : "unknown";
        errorMessage = `File is too large (${actualSizeMB} MB). Maximum file size is ${maxSizeMB} MB.`;
      } else {
        // Generic validation error message
        errorMessage = validationErrors
          .map((err: any) => err.msg || JSON.stringify(err))
          .join(", ");
      }
    } else if (typeof error.detail === "string") {
      errorMessage = error.detail;
    } else if (error.message) {
      errorMessage = typeof error.message === "string"
        ? error.message
        : JSON.stringify(error.message);
    } else {
      errorMessage = "An error occurred";
    }

    throw new ApiError(response.status, errorMessage);
  }
  return response.json();
}

export class ApiClient {
  private static config: ApiClientConfig;

  static configure(config: ApiClientConfig) {
    this.config = config;
  }

  static async fetch<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    if (!this.config) {
      throw new Error(
        "ApiClient must be configured before use. Call ApiClient.configure() first.",
      );
    }

    try {
      const headers = await getAuthHeaders(this.config.getAuthToken);

      return await fetchWithRetry<T>(
        `${this.config.baseUrl}${endpoint}`,
        {
          ...options,
          headers: {
            ...headers,
            ...options.headers,
          },
          cache: "no-store", // Disable caching for authenticated requests
        },
        this.config.getAuthToken,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw new Error("Authentication required");
      }
      throw error;
    }
  }

  static async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.fetch<T>(endpoint, { ...options, method: "GET" });
  }

  static async post<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestInit,
  ): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  static async put<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestInit,
  ): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  static async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.fetch<T>(endpoint, { ...options, method: "DELETE" });
  }

  static async uploadFile(
    endpoint: string,
    formData: FormData,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (!this.config) {
      throw new Error("ApiClient must be configured before use");
    }

    const headers = await getAuthHeaders(this.config.getAuthToken);
    // Remove Content-Type header for form data to let the browser set it with the boundary
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { "Content-Type": _, ...uploadHeaders } = headers as Record<
      string,
      string
    >;

    try {
      let response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method: "POST",
        body: formData,
        signal,
        headers: uploadHeaders,
      });

      // Handle 401 retry for file uploads too
      if (response.status === 401) {
        console.log("Upload received 401, attempting token refresh and retry");

        try {
          const freshHeaders = await getAuthHeaders(this.config.getAuthToken);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { "Content-Type": _, ...freshUploadHeaders } =
            freshHeaders as Record<string, string>;

          response = await fetch(`${this.config.baseUrl}${endpoint}`, {
            method: "POST",
            body: formData,
            signal,
            headers: freshUploadHeaders,
          });
        } catch (retryError) {
          console.warn("Upload token refresh retry failed:", retryError);
        }
      }

      return handleResponse(response);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw new Error("Authentication required");
      }
      throw error;
    }
  }

  // Book endpoints
  static books = {
    getUserBooks: () => this.get<UserBookLibrary[]>("/api/books/"),
    getBook: (id: string) => this.get<UserBookLibrary>(`/api/books/${id}`),
    createBook: (data: BookMetadataCreate) =>
      this.post<UserBookLibrary>("/api/books/", data),
    updateBook: (id: string, data: UserBookLibraryUpdate) =>
      this.put<UserBookLibrary>(`/api/books/${id}`, data),
    updateBookProgress: (id: string, data: UserBookLibraryUpdate) =>
      this.put<UserBookLibrary>(`/api/books/${id}/progress`, data),
    deleteBook: (id: string) => this.delete<void>(`/api/books/${id}`),
    deleteBookMetadata: (metadataId: string) =>
      this.delete<void>(`/api/books/metadata/${metadataId}`),
  };

  // Highlight endpoints
  static highlights = {
    getBookHighlights: (bookId: string) =>
      this.get<Highlight[]>(`/api/highlights/book/${bookId}`),
    createHighlight: (data: HighlightCreate) =>
      this.post<Highlight>("/api/highlights/", data),
    updateHighlight: (highlightId: string, data: HighlightUpdate) =>
      this.put<Highlight>(`/api/highlights/${highlightId}`, data),
    updateHighlightNote: (highlightId: string, note: string) =>
      this.put<Highlight>(`/api/highlights/${highlightId}/note`, { note }),
    deleteHighlight: (highlightId: string) =>
      this.delete<void>(`/api/highlights/${highlightId}`),
    deleteHighlightByText: (text: string) =>
      this.delete<void>(`/api/highlights/text/${encodeURIComponent(text)}`),
  };

  // RSS endpoints
  static rss = {
    // Folders
    getFolders: () => this.get<Folder[]>("/api/rss/folders/"),
    getFolder: (id: string) => this.get<Folder>(`/api/rss/folders/${id}`),
    createFolder: (data: { name: string }) =>
      this.post<Folder>("/api/rss/folders/", data),
    updateFolder: (id: string, data: { name: string }) =>
      this.put<Folder>(`/api/rss/folders/${id}`, data),
    deleteFolder: (id: string) => this.delete<void>(`/api/rss/folders/${id}`),

    // OPML Import
    importOPML: (formData: FormData) =>
      this.uploadFile(
        "/api/rss/opml/import/",
        formData,
      ) as Promise<OPMLImportResponse>,
    getImportTaskStatus: (taskId: string) =>
      this.get<ImportTaskStatus>(`/api/rss/opml/import/status/${taskId}`),
    getActiveImportTask: () =>
      this.get<ImportTaskStatus | null>("/api/rss/opml/import/active"),
    listImportTasks: () =>
      this.get<ActiveImportTask[]>("/api/rss/opml/import/tasks"),
    cancelImportTask: (taskId: string) =>
      this.delete<void>(`/api/rss/opml/import/cancel/${taskId}`),

    // Feeds
    getFeeds: (params?: {
      folder_id?: string;
      tag_names?: string[];
      is_favorite?: boolean;
      search_query?: string;
    }) => {
      const queryParams = new URLSearchParams();
      if (params?.folder_id) queryParams.append("folder_id", params.folder_id);
      if (params?.tag_names)
        params.tag_names.forEach((tag) => queryParams.append("tag_names", tag));
      if (params?.is_favorite !== undefined)
        queryParams.append("is_favorite", params.is_favorite.toString());
      if (params?.search_query)
        queryParams.append("search_query", params.search_query);

      const queryString = queryParams.toString();
      return this.get<Feed[]>(
        `/api/rss/feeds/${queryString ? `?${queryString}` : ""}`,
      );
    },
    getFeed: (id: string) => this.get<Feed>(`/api/rss/feeds/${id}`),
    createFeed: (data: { url: string; folder_id?: string }, signal?: AbortSignal) =>
      this.post<Feed>("/api/rss/feeds/", data, signal ? { signal } : undefined),
    updateFeed: (
      id: string,
      data: {
        folder_id?: string;
        is_favorite?: boolean;
        title?: string;
      },
    ) => this.put<Feed>(`/api/rss/feeds/${id}`, data),
    adminUpdateFeed: (
      id: string,
      data: {
        title?: string;
        description?: string;
        language?: string;
        top_level_category?: string;
        link?: string;
        url?: string;
        image_url?: string;
      },
    ) => this.put<Feed>(`/api/rss/feeds/${id}/admin`, data),
    refreshFeed: (
      id: string,
      forceRefetch: boolean = false,
      preview: boolean = false,
    ): Promise<Feed> => {
      const queryParams = new URLSearchParams();
      if (forceRefetch) queryParams.append("force_refetch", "true");
      if (preview) queryParams.append("preview", "true");
      const queryString = queryParams.toString();

      return this.post<Feed>(
        `/api/rss/feeds/${id}/refresh${queryString ? `?${queryString}` : ""}`,
      );
    },
    refreshFolderFeeds: (folderId: string) =>
      this.post(`/api/rss/feeds/refresh_folder/${folderId}`),
    refreshAllFeeds: () => this.post("/api/rss/feeds/refresh_all"),
    getRefreshStatus: (taskId: string) =>
      this.get(`/api/rss/feeds/refresh_status/${taskId}`),
    deleteFeed: (id: string) => this.delete(`/api/rss/feeds/${id}`),
    adminDeleteFeed: (id: string) =>
      this.delete(`/api/rss/feeds/${id}/admin`),
    subscribeToFeed: (feedId: string, data: { folder_id: string }) =>
      this.post(`/api/rss/feeds/${feedId}/subscribe`, data),
    getSimilarFeeds: (
      id: string,
      params?: {
        limit?: number;
        min_similarity?: number;
      },
    ) => {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.append("limit", params.limit.toString());
      if (params?.min_similarity)
        queryParams.append("min_similarity", params.min_similarity.toString());

      const queryString = queryParams.toString();
      return this.get<SimilarFeedsResponse>(
        `/api/rss/similar/${id}${queryString ? `?${queryString}` : ""}`,
      );
    },

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
    }): Promise<ArticlesPaginatedResponse> => {
      const queryParams = new URLSearchParams();
      if (params.feed_ids)
        params.feed_ids.forEach((id) => queryParams.append("feed_ids", id));
      if (params.folder_id) queryParams.append("folder_id", params.folder_id);
      if (params.is_read !== undefined)
        queryParams.append("is_read", params.is_read.toString());
      if (params.is_read_later !== undefined)
        queryParams.append("is_read_later", params.is_read_later.toString());
      if (params.is_favorite !== undefined)
        queryParams.append("is_favorite", params.is_favorite.toString());
      if (params.feed_is_favorite !== undefined)
        queryParams.append(
          "feed_is_favorite",
          params.feed_is_favorite.toString(),
        );
      if (params.published_since)
        queryParams.append("published_since", params.published_since);
      if (params.published_until)
        queryParams.append("published_until", params.published_until);
      if (params.search_query)
        queryParams.append("search_query", params.search_query);
      if (params.sort_by) queryParams.append("sort_by", params.sort_by);
      if (params.sort_order)
        queryParams.append("sort_order", params.sort_order);
      if (params.page) queryParams.append("page", params.page.toString());
      if (params.size) queryParams.append("size", params.size.toString());

      const queryString = queryParams.toString();
      return this.get<ArticlesPaginatedResponse>(
        `/api/rss/articles/${queryString ? `?${queryString}` : ""}`,
      );
    },
    getRecentlyReadArticles: (
      page?: number,
      size?: number,
    ): Promise<ArticlesPaginatedResponse> => {
      const queryParams = new URLSearchParams();
      if (page) queryParams.append("page", page.toString());
      if (size) queryParams.append("size", size.toString());

      const queryString = queryParams.toString();
      return this.get<ArticlesPaginatedResponse>(
        `/api/rss/articles/recently_read${queryString ? `?${queryString}` : ""}`,
      );
    },
    getReadLaterArticles: (
      page?: number,
      size?: number,
    ): Promise<ArticlesPaginatedResponse> => {
      const queryParams = new URLSearchParams();
      if (page) queryParams.append("page", page.toString());
      if (size) queryParams.append("size", size.toString());

      const queryString = queryParams.toString();
      return this.get<ArticlesPaginatedResponse>(
        `/api/rss/articles/read_later${queryString ? `?${queryString}` : ""}`,
      );
    },
    getUnreadCounts: (folderId?: string) => {
      const queryParams = new URLSearchParams();
      if (folderId) queryParams.append("folder_id", folderId);

      const queryString = queryParams.toString();
      return this.get(
        `/api/rss/articles/unread_counts${queryString ? `?${queryString}` : ""}`,
      );
    },
    getArticle: (id: string) => this.get(`/api/rss/articles/${id}`),
    updateArticle: (
      id: string,
      data: {
        is_read?: boolean;
        read_at?: string;
        is_read_later?: boolean;
        is_favorite?: boolean;
        priority?: string;
        note?: string | null;
      },
      articleType: "feed" | "clipped" = "feed",
    ) => this.put(`/api/rss/articles/${id}?article_type=${articleType}`, data),
    getTodaysArticles: (params?: {
      page?: number;
      size?: number;
    }): Promise<ArticlesPaginatedResponse> => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append("page", params.page.toString());
      if (params?.size) queryParams.append("size", params.size.toString());

      const queryString = queryParams.toString();
      return this.get<ArticlesPaginatedResponse>(
        `/api/rss/articles/today${queryString ? `?${queryString}` : ""}`,
      );
    },

    saveArticle: (data: {
      url: string;
      title?: string;
      content?: string;
      metadata?: Record<string, string>;
    }) => this.post("/api/rss/articles/save", data),

    checkArticleSaved: (url: string) => {
      const queryParams = new URLSearchParams();
      queryParams.append("url", url);
      return this.get(`/api/rss/articles/check-saved?${queryParams.toString()}`);
    },

    // Discover endpoints
    searchFeeds: (params?: {
      q?: string;
      category?: string;
      language?: string;
      limit?: number;
    }) => {
      const queryParams = new URLSearchParams();
      if (params?.q) queryParams.append("q", params.q);
      if (params?.category) queryParams.append("category", params.category);
      if (params?.language) queryParams.append("language", params.language);
      if (params?.limit) queryParams.append("limit", params.limit.toString());

      const queryString = queryParams.toString();
      return this.get<DiscoverSearchResponse>(
        `/api/rss/discover/search${queryString ? `?${queryString}` : ""}`,
      );
    },

    getCategories: (params?: { language?: string }) => {
      const queryParams = new URLSearchParams();
      if (params?.language) queryParams.append("language", params.language);

      const queryString = queryParams.toString();
      return this.get(
        `/api/rss/discover/categories${queryString ? `?${queryString}` : ""}`,
      );
    },

    getCategoryFeeds: (
      categoryName: string,
      params?: {
        language?: string;
        limit?: number;
      },
    ) => {
      const queryParams = new URLSearchParams();
      if (params?.language) queryParams.append("language", params.language);
      if (params?.limit) queryParams.append("limit", params.limit.toString());

      const queryString = queryParams.toString();
      return this.get(
        `/api/rss/discover/categories/${encodeURIComponent(categoryName)}${queryString ? `?${queryString}` : ""}`,
      );
    },

    getPreviewArticles: (feedUrl: string, limit: number = 25) => {
      const queryParams = new URLSearchParams();
      queryParams.set("url", feedUrl);
      queryParams.set("limit", limit.toString());

      const queryString = queryParams.toString();
      return this.get(
        `/api/rss/discover/preview/articles${queryString ? `?${queryString}` : ""}`,
      );
    },
  };

  // User/Profile endpoints
  static users = {
    getProfile: () => this.get("/api/users/profile"),
  };
}
