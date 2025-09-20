// Export query keys
export {
  RSS_QUERY_KEYS,
  ARTICLE_ENHANCEMENT_QUERY_KEYS,
  BOOK_QUERY_KEYS,
  USER_QUERY_KEYS,
  type QueryKey,
} from "./query-keys";

// Export hooks
export * from "./hooks";

// Export types
export * from "./types";

// Export the full ApiClient with all functionality
export {
  ApiClient,
  ApiError,
  type AuthTokenProvider,
  type ApiClientConfig,
} from "./client";

// Note: ApiWebClient and ApiExtensionClient have been moved to their respective apps
// - ApiWebClient is now in apps/web/lib/api-client.ts
// - ApiExtensionClient is now in apps/extension/src/lib/api-client.ts
// This provides better separation of concerns and eliminates cross-app dependencies
