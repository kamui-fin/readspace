"use client"

// Import api-client to ensure ApiClient is configured before any queries run
import { configureApiClient } from "@/lib/api-client"
import { initAuthStateListener } from "@/lib/auth/token-cache"
import { getQueryClient } from "@/lib/get-query-client"
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactNode, useEffect } from "react"

interface QueryProviderProps {
    children: ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
    // NOTE: Avoid useState when initializing the query client if you don't
    //       have a suspense boundary between this and the code that may
    //       suspend because React will throw away the client on the initial
    //       render if it suspends and there is no boundary
    configureApiClient()
    const queryClient = getQueryClient()

    // Initialize auth state listener
    useEffect(() => {
        // Set up auth state listener to clear token cache on sign out
        initAuthStateListener()
    }, [])

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}
