// Export query keys
export {
  ARTICLE_ENHANCEMENT_QUERY_KEYS, RSS_QUERY_KEYS, USER_QUERY_KEYS,
  type QueryKey
} from "./query-keys";

// Export hooks
export * from "./hooks";

// Export types
export * from "./types";

// Export the full ApiClient with all functionality
export {
  ApiClient,
  ApiError, type ApiClientConfig, type AuthTokenProvider
} from "./client";

// Note: ApiWebClient and ApiExtensionClient have been moved to their respective apps
// - ApiWebClient is now in apps/web/lib/api-client.ts
// - ApiExtensionClient is now in apps/extension/src/lib/api-client.ts
// This provides better separation of concerns and eliminates cross-app dependencies
