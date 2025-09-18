"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import { getQueryClient } from "@/lib/get-query-client"
import { ReactNode, useEffect } from "react"
import { ApiClient } from "@readspace/shared"
import { createClient } from "@/lib/supabase/client"
import { env } from "@/env"

interface QueryProviderProps {
    children: ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
    // NOTE: Avoid useState when initializing the query client if you don't
    //       have a suspense boundary between this and the code that may
    //       suspend because React will throw away the client on the initial
    //       render if it suspends and there is no boundary
    const queryClient = getQueryClient()

    useEffect(() => {
        // Configure ApiClient with auth token provider
        const supabase = createClient()

        ApiClient.configure({
            baseUrl: env.NEXT_PUBLIC_API_BASE_URL,
            getAuthToken: async () => {
                const { data: { session } } = await supabase.auth.getSession()
                return session?.access_token || null
            }
        })
    }, [])

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}
