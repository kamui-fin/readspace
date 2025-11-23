import { createClient as createBrowserClient } from "@/lib/supabase/client"
import { createClient as createServerClient } from "@/lib/supabase/server"

// Global token cache shared across all API calls
let cachedToken: string | null = null
let tokenExpiresAt = 0
let refreshPromise: Promise<string | null> | null = null

// Token cache TTL - 50 seconds (tokens expire in 60s, fetch early)
const TOKEN_CACHE_TTL = 50 * 1000

/**
 * Get authentication token with global caching and request deduplication.
 * 
 * This function ensures that:
 * 1. Only ONE token fetch happens at a time (mutex via refreshPromise)
 * 2. Token is cached globally and shared across all API calls
 * 3. Supabase client is reused (singleton pattern)
 * 
 * @returns Promise<string | null> - Auth token or null if not authenticated
 */
export const getAuthToken = async (): Promise<string | null> => {
    const now = Date.now()

    // Return cached token if still valid
    if (cachedToken && now < tokenExpiresAt) {
        return cachedToken
    }

    // If refresh is already in progress, wait for it (prevents stampede)
    if (refreshPromise) {
        return refreshPromise
    }

    // Start new refresh with mutex
    refreshPromise = (async () => {
        try {
            const isBrowser = typeof window !== "undefined"

            if (isBrowser) {
                try {
                    const supabase = createBrowserClient()
                    const {
                        data: { session },
                    } = await supabase.auth.getSession()

                    // Update cache
                    cachedToken = session?.access_token || null
                    tokenExpiresAt = now + TOKEN_CACHE_TTL

                    return cachedToken
                } catch (error) {
                    console.warn("Failed to get browser session:", error)
                    return null
                }
            }

            // Server-side token fetch
            try {
                const supabase = await createServerClient()
                const {
                    data: { session },
                } = await supabase.auth.getSession()

                // Update cache
                cachedToken = session?.access_token || null
                tokenExpiresAt = now + TOKEN_CACHE_TTL

                return cachedToken
            } catch (error) {
                console.debug(
                    "Server auth not available (normal during build/SSR):",
                    error instanceof Error ? error.message : error
                )
                return null
            }
        } finally {
            // Clear the promise so next call can start fresh
            refreshPromise = null
        }
    })()

    return refreshPromise
}

/**
 * Clear the token cache (useful for logout or token invalidation)
 */
export const clearTokenCache = () => {
    cachedToken = null
    tokenExpiresAt = 0
    refreshPromise = null
}

/**
 * Initialize auth state listener to clear cache on sign out.
 * Call this once in your app initialization.
 */
export const initAuthStateListener = () => {
    if (typeof window === "undefined") return

    const supabase = createBrowserClient()
    
    supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
            clearTokenCache()
        }
        // On TOKEN_REFRESHED, the cache will naturally expire and refetch
    })
}
