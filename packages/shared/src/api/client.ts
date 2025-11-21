import type {
  ActiveImportTask,
  Article,
  CheckArticleSavedResponse,
  Feed,
  Folder,
  ImportTaskStatus,
  OPMLImportCancelResponse,
  OPMLImportResponse,
  SaveArticleResponse,
  SimilarFeedsResponse,
  Subscription,
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

// Type for token refresh function that returns a fresh token
export type TokenRefreshProvider = () => Promise<string | null>;

// Configuration interface for the API client
export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken: AuthTokenProvider;
  refreshToken?: TokenRefreshProvider;
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
  refreshToken?: TokenRefreshProvider,
): Promise<T> {
  let response = await fetch(url, options);

  // If we get a 401, try refreshing the token and retry once
  // But only if we had a token in the first place (user is logged in)
  if (response.status === 401) {
    const hadToken =
      options.headers &&
      "Authorization" in (options.headers as Record<string, string>);

    if (hadToken) {
      console.log("Received 401, attempting token refresh and retry");

      try {
        let freshToken: string | null = null;

        // If a refresh token provider is configured, use it to get a fresh token
        if (refreshToken) {
          console.log("Calling refresh token provider");
          freshToken = await refreshToken();
        }

        // If refresh provider didn't work or isn't configured, try getting token again
        if (!freshToken) {
          console.log("Refresh provider failed or not configured, trying getAuthToken");
          freshToken = await getAuthToken();
        }

        // Only retry if we got a fresh token
        if (freshToken) {
          const freshHeaders = {
            ...await getAuthHeaders(getAuthToken),
            Authorization: `Bearer ${freshToken}`,
          };

          // Retry the request with fresh token
          response = await fetch(url, {
            ...options,
            headers: {
              ...freshHeaders,
              ...options.headers,
            },
          });
        }
      } catch (retryError) {
        console.warn("Token refresh retry failed:", retryError);
        // Fall through to handle the original 401 response
      }
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
          err.loc?.includes("file_size_bytes"),
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
      errorMessage =
        typeof error.message === "string"
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

      // Normalize URL to prevent double slashes
      const baseUrl = this.config.baseUrl.replace(/\/$/, "");
      const normalizedEndpoint = endpoint.startsWith("/")
        ? endpoint
        : `/${endpoint}`;

      return await fetchWithRetry<T>(
        `${baseUrl}${normalizedEndpoint}`,
        {
          ...options,
          headers: {
            ...headers,
            ...options.headers,
          },
          cache: "no-store", // Disable caching for authenticated requests
        },
        this.config.getAuthToken,
        this.config.refreshToken,
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

  static async patch<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestInit,
  ): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  static async delete<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestInit,
  ): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: "DELETE",
      body: data ? JSON.stringify(data) : undefined,
    });
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
      // Normalize URL to prevent double slashes
      const baseUrl = this.config.baseUrl.replace(/\/$/, "");
      const normalizedEndpoint = endpoint.startsWith("/")
        ? endpoint
        : `/${endpoint}`;
      const url = `${baseUrl}${normalizedEndpoint}`;

      let response = await fetch(url, {
        method: "POST",
        body: formData,
        signal,
        headers: uploadHeaders,
      });

      // Handle 401 retry for file uploads too
      // But only if we had a token in the first place (user is logged in)
      if (response.status === 401) {
        const hadToken = uploadHeaders.Authorization;

        if (hadToken) {
          console.log(
            "Upload received 401, attempting token refresh and retry",
          );

          try {
            let freshToken: string | null = null;

            // If a refresh token provider is configured, use it to get a fresh token
            if (this.config.refreshToken) {
              console.log("Calling refresh token provider for upload");
              freshToken = await this.config.refreshToken();
            }

            // If refresh provider didn't work or isn't configured, try getting token again
            if (!freshToken) {
              console.log("Refresh provider failed or not configured for upload, trying getAuthToken");
              freshToken = await this.config.getAuthToken();
            }

            // Only retry if we got a fresh token
            if (freshToken) {
              const freshHeaders = {
                Authorization: `Bearer ${freshToken}`,
              };

              response = await fetch(url, {
                method: "POST",
                body: formData,
                signal,
                headers: freshHeaders,
              });
            }
          } catch (retryError) {
            console.warn("Upload token refresh retry failed:", retryError);
          }
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

  // RSS endpoints
  static rss = {
    // Folders
    getFolders: () => this.get<Folder[]>("/api/folders/"),
    getFolder: (id: string) => this.get<Folder>(`/api/folders/${id}`),
    createFolder: (data: { name: string }) =>
      this.post<Folder>("/api/folders/", data),
    updateFolder: (id: string, data: { name: string }) =>
      this.put<Folder>(`/api/folders/${id}`, data),
    deleteFolder: (id: string) => this.delete<void>(`/api/folders/${id}`),

    // OPML Import
    importOPML: (formData: FormData) =>
      this.uploadFile(
        "/api/opml/import/",
        formData,
      ) as Promise<OPMLImportResponse>,
    getImportTaskStatus: (taskId: string) =>
      this.get<ImportTaskStatus>(`/api/opml/import/status/${taskId}`),
    getActiveImportTask: () =>
      this.get<ImportTaskStatus | null>("/api/opml/import/active"),
    listImportTasks: () =>
      this.get<ActiveImportTask[]>("/api/opml/import/tasks"),
    cancelImportTask: (taskId: string) =>
      this.delete<OPMLImportCancelResponse>(`/api/opml/import/cancel/${taskId}`),

    // Feeds
    getFeeds: (params?: {
      folder_id?: string;
    }) => {
      const queryParams = new URLSearchParams();
      if (params?.folder_id) queryParams.append("folder_id", params.folder_id);

      queryParams.append("include_unread_counts", "true");

      const queryString = queryParams.toString();
      return this.get<Feed[]>(
        `/api/feeds/${queryString ? `?${queryString}` : ""}`,
      );
    },
    getFeed: (id: string) => this.get<Feed>(`/api/feeds/${id}`),
    createFeed: (
      data: { url: string; folder_id?: string },
      signal?: AbortSignal,
    ) =>
      this.post<Subscription>(
        "/api/feeds/",
        data,
        signal ? { signal } : undefined,
      ),
    updateFeed: (
      id: string,
      data: {
        folder_id?: string;
        is_favorite?: boolean;
        title?: string;
      },
    ) => this.put<Feed>(`/api/feeds/${id}`, data),
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
    ) => this.put<Feed>(`/api/feeds/${id}/admin`, data),
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
        `/api/feeds/${id}/refresh${queryString ? `?${queryString}` : ""}`,
      );
    },
    refreshAllFeeds: () => this.post("/api/feeds/refresh"),
    getRefreshStatus: (taskId: string) =>
      this.get(`/api/feeds/refresh-status/${taskId}`),
    deleteFeed: (id: string) => this.delete(`/api/feeds/${id}`),
    adminDeleteFeed: (id: string) => this.delete(`/api/feeds/${id}/admin`),
    bulkDeleteFeeds: (feed_ids: string[]) =>
      this.delete<{
        deleted_count: number;
        deleted_ids: string[];
      }>("/api/feeds/", { feed_ids }),
    bulkUpdateFeedsFolder: (feed_ids: string[], folder_id: string) =>
      this.patch<{
        updated_count: number;
        updated_ids: string[];
        folder_id: string;
      }>("/api/feeds/folder", { feed_ids, folder_id }),
    markFeedAllRead: (feed_id: string) =>
      this.put<{
        message: string;
        feed_id: string;
        cutoff_timestamp: string;
      }>(`/api/feeds/${feed_id}/read-status`),
    markFolderAllRead: (folder_id: string) =>
      this.put<{
        message: string;
        folder_id: string;
        updated_subscriptions: number;
      }>(`/api/folders/${folder_id}/read-status`),
    subscribeToFeed: (feedId: string, data: { folder_id: string }) =>
      this.post(`/api/feeds/${feedId}/subscribe`, data),
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
        `/api/similar/${id}${queryString ? `?${queryString}` : ""}`,
      );
    },

    // Articles (cursor-based pagination)
    getArticles: (params: {
      cursor?: string;
      limit?: number;
      feed_ids?: string[];
      folder_id?: string;
      is_read?: boolean;
      is_read_later?: boolean;
      is_favorite?: boolean;
    }): Promise<{
      items: Article[];
      next_cursor: string | null;
      has_more: boolean;
      total_count: number | null;
    }> => {
      const queryParams = new URLSearchParams();
      if (params.cursor) queryParams.append("cursor", params.cursor);
      if (params.limit) queryParams.append("limit", params.limit.toString());
      if (params.feed_ids)
        params.feed_ids.forEach((id) => queryParams.append("feed_ids", id));
      if (params.folder_id) queryParams.append("folder_id", params.folder_id);
      if (params.is_read !== undefined)
        queryParams.append("is_read", params.is_read.toString());
      if (params.is_read_later !== undefined)
        queryParams.append("is_read_later", params.is_read_later.toString());
      if (params.is_favorite !== undefined)
        queryParams.append("is_favorite", params.is_favorite.toString());

      const queryString = queryParams.toString();
      return this.get<{
        items: Article[];
        next_cursor: string | null;
        has_more: boolean;
        total_count: number | null;
      }>(`/api/articles/${queryString ? `?${queryString}` : ""}`);
    },
    getRecentlyReadArticles: (params?: {
      cursor?: string;
      limit?: number;
    }): Promise<{
      items: Article[];
      next_cursor: string | null;
      has_more: boolean;
      total_count: number | null;
    }> => {
      const queryParams = new URLSearchParams();
      if (params?.cursor) queryParams.append("cursor", params.cursor);
      if (params?.limit) queryParams.append("limit", params.limit.toString());

      const queryString = queryParams.toString();
      return this.get<{
        items: Article[];
        next_cursor: string | null;
        has_more: boolean;
        total_count: number | null;
      }>(`/api/articles/recently-read${queryString ? `?${queryString}` : ""}`);
    },
    getReadLaterArticles: (params?: {
      cursor?: string;
      limit?: number;
    }): Promise<{
      items: Article[];
      next_cursor: string | null;
      has_more: boolean;
      total_count: number | null;
    }> => {
      const queryParams = new URLSearchParams();
      if (params?.cursor) queryParams.append("cursor", params.cursor);
      if (params?.limit) queryParams.append("limit", params.limit.toString());

      const queryString = queryParams.toString();
      return this.get<{
        items: Article[];
        next_cursor: string | null;
        has_more: boolean;
        total_count: number | null;
      }>(`/api/articles/read-later${queryString ? `?${queryString}` : ""}`);
    },
    getUnreadCounts: (folderId?: string) => {
      const queryParams = new URLSearchParams();
      if (folderId) queryParams.append("folder_id", folderId);

      const queryString = queryParams.toString();
      return this.get(
        `/api/articles/unread-counts${queryString ? `?${queryString}` : ""}`,
      );
    },
    getArticle: (id: string) => this.get(`/api/articles/${id}`),
    updateArticle: (
      id: string,
      data: {
        is_read?: boolean;
        read_at?: string;
        is_read_later?: boolean;
        is_favorite?: boolean;
        priority?: string;
        note?: string | null;
        title?: string;
      },
      articleType: "feed" | "clipped" = "feed",
    ) => this.put(`/api/articles/${id}?article_type=${articleType}`, data),
    getTodaysArticles: (params?: {
      cursor?: string;
      limit?: number;
    }): Promise<{
      items: Article[];
      next_cursor: string | null;
      has_more: boolean;
      total_count: number | null;
    }> => {
      const queryParams = new URLSearchParams();
      if (params?.cursor) queryParams.append("cursor", params.cursor);
      if (params?.limit) queryParams.append("limit", params.limit.toString());

      const queryString = queryParams.toString();
      return this.get<{
        items: Article[];
        next_cursor: string | null;
        has_more: boolean;
        total_count: number | null;
      }>(`/api/articles/today${queryString ? `?${queryString}` : ""}`);
    },

    saveArticle: (data: {
      url: string;
      title?: string;
      content?: string;
      metadata?: Record<string, string>;
    }) => this.post<SaveArticleResponse>("/api/articles/", data),

    checkArticleSaved: (url: string) => {
      const queryParams = new URLSearchParams();
      queryParams.append("url", url);
      return this.get<CheckArticleSavedResponse>(
        `/api/articles/check-saved?${queryParams.toString()}`
      );
    },
  };

  // User/Profile endpoints
  static users = {
    getProfile: () => this.get("/api/users/profile"),
  };
}
