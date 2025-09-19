"use client"

import { useEffect } from "react"
import { ApiWebClient } from "@/lib/api-client"

/**
 * Hook that ensures the ApiWebClient is registered with the ClientProvider.
 * This allows shared hooks to automatically use the web API client.
 *
 * Call this hook once in your root component or layout to initialize
 * the dependency injection system.
 */
export function useApiClient() {
    useEffect(() => {
        // Trigger the auto-configuration which will register the client
        // We don't need to wait for the result, just trigger the process
        ApiWebClient.isConfigured() || ApiWebClient.fetch("/health").catch(() => {
            // Ignore errors during initialization - the client will auto-configure
            // on the first real API call
        })
    }, [])

    return {
        isConfigured: ApiWebClient.isConfigured()
    }
}