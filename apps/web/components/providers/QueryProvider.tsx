"use client"

import { env } from "@/env"
import { getQueryClient } from "@/lib/get-query-client"
import { createClient as createBrowserClient } from "@/lib/supabase/client"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { ApiClient, type AuthTokenProvider } from "@readspace/shared"
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactNode } from "react"

interface QueryProviderProps {
    children: ReactNode
}

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

// Configure the shared ApiClient once
ApiClient.configure({
    baseUrl: env.NEXT_PUBLIC_API_BASE_URL || "http://0.0.0.0:8008",
    getAuthToken: authTokenProvider,
})

export function QueryProvider({ children }: QueryProviderProps) {
    // NOTE: Avoid useState when initializing the query client if you don't
    //       have a suspense boundary between this and the code that may
    //       suspend because React will throw away the client on the initial
    //       render if it suspends and there is no boundary
    const queryClient = getQueryClient()

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}
