import { ApiClient } from "@readspace/shared"
import { createClient } from "@/lib/supabase/server"
import { env } from "@/env"

let isServerConfigured = false
let configurationPromise: Promise<void> | null = null

/**
 * Ensures ApiClient is configured for server-side usage.
 * This must be called before making any ApiClient calls in server components.
 * Handles concurrent calls to prevent race conditions.
 *
 * NOTE: This function uses the base ApiClient for server-side usage.
 * For client-side usage, use ApiWebClient.create() directly instead.
 */
export async function ensureServerApiClient() {
    // If already configured, return immediately
    if (isServerConfigured) {
        return
    }

    // If configuration is in progress, wait for it
    if (configurationPromise) {
        await configurationPromise
        return
    }

    // Start configuration
    configurationPromise = (async () => {
        try {
            const supabase = await createClient()

            ApiClient.configure({
                baseUrl: env.NEXT_PUBLIC_API_BASE_URL,
                getAuthToken: async () => {
                    try {
                        // Always fetch fresh session - let Supabase handle caching/refresh
                        const { data: { session }, error } = await supabase.auth.getSession()

                        if (error) {
                            console.warn("Failed to get session:", error.message)
                            return null
                        }

                        if (!session) {
                            console.warn("No session available for API request")
                            return null
                        }

                        return session.access_token
                    } catch (err) {
                        console.error("Error getting auth token:", err)
                        return null
                    }
                }
            })

            isServerConfigured = true
        } catch (err) {
            console.error("Failed to configure server API client:", err)
            configurationPromise = null
            throw err
        }
    })()

    await configurationPromise
}

/**
 * Check if the API client is properly configured.
 * Useful for debugging configuration issues.
 */
export function isApiClientConfigured(): boolean {
    return isServerConfigured
}

/**
 * NOTE: For client-side usage, simply use ApiWebClient directly:
 *
 * import { ApiWebClient } from '@/lib/api-client'
 * const articles = await ApiWebClient.rss.getArticles({ page: 1 })
 *
 * ApiWebClient will auto-configure itself on first use in browser environments.
 */