import { env } from "@/env"
import { getAuthToken } from "@/lib/auth/token-cache"
import { ApiClient } from "@readspace/shared"

// Configure the shared ApiClient once with global token cache
export const configureApiClient = () => {
    ApiClient.configure({
        baseUrl: env.NEXT_PUBLIC_API_BASE_URL || "http://0.0.0.0:8008",
        getAuthToken,
    })
}

// Auto-configure on import
configureApiClient()

/**
 * Pre-configured API client for the web application.
 *
 * @example
 * ```typescript
 * import { ApiClient } from '@/lib/api-client'
 *
 * const articles = await ApiClient.getArticles({ page: 1 })
 * const folders = await ApiClient.getFolders()
 * ```
 */
