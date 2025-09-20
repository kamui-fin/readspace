import { env } from "@/env"
import { createClient as createBrowserClient } from "@/lib/supabase/client"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { ApiClient, type AuthTokenProvider } from "@readspace/shared"

const authTokenProvider: AuthTokenProvider = async (): Promise<
    string | null
> => {
    const isBrowser = typeof window !== "undefined"

    if (isBrowser) {
        try {
            const supabase = createBrowserClient()
            const {
                data: { session },
            } = await supabase.auth.getSession()
            return session?.access_token || null
        } catch (error) {
            console.warn("Failed to get browser session:", error)
            return null
        }
    }

    try {
        const supabase = await createServerClient()
        const {
            data: { session },
        } = await supabase.auth.getSession()
        return session?.access_token || null
    } catch (error) {
        console.debug(
            "Server auth not available (normal during build/SSR):",
            error instanceof Error ? error.message : error
        )
        return null
    }
}

let configured = false

export function configureApiClient() {
    if (!configured) {
        ApiClient.configure({
            baseUrl: env.NEXT_PUBLIC_API_BASE_URL || "http://0.0.0.0:8008",
            getAuthToken: authTokenProvider,
        })
        configured = true
    }
}

// Configure immediately for server-side usage
configureApiClient()
