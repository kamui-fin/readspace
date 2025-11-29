"use client"

import { createContext, useContext } from "react"
import type { UseArticlesControllerResult } from "./hooks/use-articles-controller"

const ArticlesContext = createContext<UseArticlesControllerResult | null>(null)

export function useArticlesContext() {
    const context = useContext(ArticlesContext)
    if (!context) {
        throw new Error(
            "useArticlesContext must be used within an ArticlesProvider"
        )
    }
    return context
}

interface ArticlesProviderProps {
    value: UseArticlesControllerResult
    children: React.ReactNode
}

export function ArticlesProvider({ value, children }: ArticlesProviderProps) {
    return (
        <ArticlesContext.Provider value={value}>
            {children}
        </ArticlesContext.Provider>
    )
}
