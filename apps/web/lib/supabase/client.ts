import { Database } from "@/database.types"
import { env } from "@/env"
import { createBrowserClient } from "@supabase/ssr"

// Singleton browser client to prevent creating multiple instances
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export const createClient = () => {
    // Only create client in browser environment
    if (typeof window === "undefined") {
        return createBrowserClient<Database>(
            env.NEXT_PUBLIC_SUPABASE_URL,
            env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )
    }

    // Return existing client or create new one
    if (!browserClient) {
        browserClient = createBrowserClient<Database>(
            env.NEXT_PUBLIC_SUPABASE_URL,
            env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )
    }

    return browserClient
}
