import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query"
import {
    ApiError,
    isDowngradeRequiredError,
    queryKeys,
} from "@readspace/shared"
import { useUpgradeDialog } from "@/stores/upgrade-dialog"

function makeQueryClient() {
    const handleGlobalError = (error: unknown) => {
        // The user was downgraded while holding more than their plan allows. Refetch limits so
        // the protected layout swaps in the downgrade flow (limits may have been cached as fine).
        if (isDowngradeRequiredError(error)) {
            // `client` is declared below; this only runs after it's constructed.
            client.invalidateQueries({ queryKey: queryKeys.userLimits() })
            return
        }
        if (error instanceof ApiError && error.status === 429) {
            useUpgradeDialog.getState().open({
                title: "Upgrade to Readspace Pro",
                description:
                    error.message ||
                    "You have reached a limit on your current plan.",
            })
        }
    }

    const client = new QueryClient({
        queryCache: new QueryCache({
            onError: handleGlobalError,
        }),
        mutationCache: new MutationCache({
            onError: handleGlobalError,
        }),
        defaultOptions: {
            queries: {
                retry: 1,
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
    return client
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
