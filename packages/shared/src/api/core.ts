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

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Normalize URL by removing trailing slash from base and ensuring endpoint starts with /
 */
function normalizeUrl(baseUrl: string, endpoint: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

/**
 * Get authorization headers with token
 */
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

/**
 * Parse error response from FastAPI
 */
function parseErrorMessage(error: any): string {
  // Handle FastAPI validation errors (array of error objects)
  if (Array.isArray(error.detail)) {
    const validationErrors = error.detail;

    // Check for file size validation error
    const fileSizeError = validationErrors.find(
      (err: any) =>
        err.type === "less_than_equal" && err.loc?.includes("file_size_bytes"),
    );

    if (fileSizeError?.ctx?.le) {
      const maxSizeMB = (fileSizeError.ctx.le / (1024 * 1024)).toFixed(0);
      const actualSizeMB = fileSizeError.input
        ? (fileSizeError.input / (1024 * 1024)).toFixed(1)
        : "unknown";
      return `File is too large (${actualSizeMB} MB). Maximum file size is ${maxSizeMB} MB.`;
    }

    // Generic validation error message
    return validationErrors
      .map((err: any) => err.msg || JSON.stringify(err))
      .join(", ");
  }

  // Handle string detail
  if (typeof error.detail === "string") {
    return error.detail;
  }

  // Handle message field
  if (error.message) {
    return typeof error.message === "string"
      ? error.message
      : JSON.stringify(error.message);
  }

  return "An error occurred";
}

/**
 * Handle response and throw ApiError if not ok
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "An error occurred" }));

    throw new ApiError(response.status, parseErrorMessage(error));
  }
  return response.json();
}

/**
 * Attempt to refresh token and retry request
 */
async function retryWithFreshToken<T>(
  url: string,
  options: RequestInit,
  getAuthToken: AuthTokenProvider,
  refreshToken?: TokenRefreshProvider,
): Promise<T> {
  console.log("Received 401, attempting token refresh and retry");

  // Try refresh provider first, fallback to getAuthToken
  let freshToken: string | null = null;

  if (refreshToken) {
    console.log("Calling refresh token provider");
    freshToken = await refreshToken();
  }

  if (!freshToken) {
    console.log("Refresh provider unavailable, trying getAuthToken");
    freshToken = await getAuthToken();
  }

  // Only retry if we got a fresh token
  if (!freshToken) {
    throw new Error("Unable to refresh authentication token");
  }

  // Retry request with fresh token
  const freshHeaders = {
    ...options.headers,
    Authorization: `Bearer ${freshToken}`,
  };

  const response = await fetch(url, {
    ...options,
    headers: freshHeaders,
  });

  return handleResponse<T>(response);
}

/**
 * Perform fetch with automatic 401 retry logic
 */
async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  getAuthToken: AuthTokenProvider,
  refreshToken?: TokenRefreshProvider,
): Promise<T> {
  const response = await fetch(url, options);

  // If we get a 401 and had a token, try refreshing
  if (response.status === 401) {
    const hadToken =
      options.headers &&
      "Authorization" in (options.headers as Record<string, string>);

    if (hadToken) {
      try {
        return await retryWithFreshToken<T>(
          url,
          options,
          getAuthToken,
          refreshToken,
        );
      } catch (retryError) {
        console.warn("Token refresh retry failed:", retryError);
        // Fall through to handle the original 401 response
      }
    }
  }

  return handleResponse<T>(response);
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
      const url = normalizeUrl(this.config.baseUrl, endpoint);

      return await fetchWithRetry<T>(
        url,
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

    try {
      const headers = await getAuthHeaders(this.config.getAuthToken);
      // Remove Content-Type header for form data to let the browser set it with the boundary
      const { "Content-Type": _, ...uploadHeaders } = headers;

      const url = normalizeUrl(this.config.baseUrl, endpoint);

      const response = await fetch(url, {
        method: "POST",
        body: formData,
        signal,
        headers: uploadHeaders,
      });

      // Handle 401 retry for file uploads
      if (response.status === 401 && uploadHeaders.Authorization) {
        try {
          return await retryWithFreshToken(
            url,
            { method: "POST", body: formData, signal },
            this.config.getAuthToken,
            this.config.refreshToken,
          );
        } catch (retryError) {
          console.warn("Upload token refresh retry failed:", retryError);
          // Fall through to handle the original 401 response
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
}
