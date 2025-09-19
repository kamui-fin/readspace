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
        // Configure ApiClient with auth token provider for client-side usage
        const supabase = createClient()

        ApiClient.configure({
            baseUrl: env.NEXT_PUBLIC_API_BASE_URL,
            getAuthToken: async () => {
                try {
                    // Always fetch fresh session - Supabase handles automatic token refresh
                    const { data: { session }, error } = await supabase.auth.getSession()

                    if (error) {
                        console.warn("Failed to get session:", error.message)
                        // Try to refresh the session if getSession fails
                        try {
                            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
                            if (refreshError || !refreshData.session) {
                                console.warn("Session refresh also failed:", refreshError?.message)
                                return null
                            }
                            return refreshData.session.access_token
                        } catch (refreshErr) {
                            console.error("Error refreshing session:", refreshErr)
                            return null
                        }
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
    }, [])

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}
