"use client"

import { create } from "zustand"

interface NavigationState {
    pendingPath: string | null
    setPendingPath: (path: string | null) => void
    isNavigating: boolean
    setIsNavigating: (isNavigating: boolean) => void
}

export const useNavigationState = create<NavigationState>((set) => ({
    pendingPath: null,
    setPendingPath: (path) => set({ pendingPath: path }),
    isNavigating: false,
    setIsNavigating: (isNavigating) => set({ isNavigating }),
}))

// Hook to handle optimistic navigation
export function useOptimisticNavigation() {
    const { setPendingPath, setIsNavigating } = useNavigationState()

    const handleOptimisticClick = (href: string) => {
        setPendingPath(href)
        setIsNavigating(true)

        // Clear the pending state after a reasonable timeout
        const timeout = setTimeout(() => {
            setPendingPath(null)
            setIsNavigating(false)
        }, 3000) // 3 second timeout

        return timeout
    }

    return { handleOptimisticClick }
}

// Hook to clear pending state when navigation completes
export function useClearPendingNavigation() {
    const { pendingPath, setPendingPath, setIsNavigating } =
        useNavigationState()

    const clearPending = () => {
        if (pendingPath) {
            setPendingPath(null)
            setIsNavigating(false)
        }
    }

    return { clearPending, pendingPath }
}
