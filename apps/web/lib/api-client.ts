import { env } from "@/env"
import { getAuthToken } from "@/lib/auth/token-cache"
import { ApiClient } from "@readspace/shared"

// Configure the shared ApiClient once with global token cache
ApiClient.configure({
    baseUrl: env.NEXT_PUBLIC_API_BASE_URL || "http://0.0.0.0:8008",
    getAuthToken,
})

/**
 * Pre-configured API client for the web application.
 *
 * @example
 * ```typescript
 * import { ApiClient } from '@/lib/api-client'
 *
 * const articles = await ApiClient.rss.getArticles({ page: 1 })
 * const folders = await ApiClient.rss.getFolders()
 * ```
 */
