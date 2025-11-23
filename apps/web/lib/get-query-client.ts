import { QueryClient } from "@tanstack/react-query"

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // With SSR, we usually want to set some default staleTime
                // above 0 to avoid refetching immediately on the client
                staleTime: 5 * 60 * 1000, // 5 minutes
                // Keep data in cache for 30 minutes (longer than staleTime)
                gcTime: 30 * 60 * 1000, // 30 minutes
                retry: 1,
                // Prevent redundant requests during navigation
                refetchOnMount: false,
                refetchOnWindowFocus: false,
                // Only refetch on reconnect if data is stale
                refetchOnReconnect: false,
                // Dedupe requests to the same endpoint
                notifyOnChangeProps: "all",
            },
            mutations: {
                // Add global error handling for mutations
                retry: false,
            },
        },
    })
}

let browserQueryClient: QueryClient | undefined = undefined

export function getQueryClient() {
    if (typeof window === "undefined") {
        // Server: always make a new query client
        return makeQueryClient()
    } else {
        // Browser: make a new query client if we don't already have one
        // This is very important, so we don't re-make a new client if React
        // suspends during the initial render. This may not be needed if we
        // have a suspense boundary BELOW the creation of the query client
        if (!browserQueryClient) browserQueryClient = makeQueryClient()
        return browserQueryClient
    }
}
