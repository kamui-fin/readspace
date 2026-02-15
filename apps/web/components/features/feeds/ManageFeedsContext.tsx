"use client"

import { createContext, useContext } from "react"
import type { UseFeedManagementResult } from "./hooks/use-feed-management"

const ManageFeedsContext = createContext<UseFeedManagementResult | null>(null)

export function useManageFeedsContext() {
    const context = useContext(ManageFeedsContext)
    if (!context) {
        throw new Error(
            "useManageFeedsContext must be used within a ManageFeedsProvider"
        )
    }
    return context
}

interface ManageFeedsProviderProps {
    value: UseFeedManagementResult
    children: React.ReactNode
}

export function ManageFeedsProvider({
    value,
    children,
}: ManageFeedsProviderProps) {
    return (
        <ManageFeedsContext.Provider value={value}>
            {children}
        </ManageFeedsContext.Provider>
    )
}
