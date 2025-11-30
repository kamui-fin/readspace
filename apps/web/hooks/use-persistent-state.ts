import { useEffect, useState } from "react"

/**
 * Custom hook for persisting state to localStorage
 */
export function usePersistentState<T>(key: string, initialValue: T) {
    const [state, setState] = useState<T>(initialValue)
    const [isInitialized, setIsInitialized] = useState(false)

    useEffect(() => {
        if (typeof window === "undefined") return

        try {
            const storedValue = localStorage.getItem(key)
            if (storedValue !== null) {
                setState(JSON.parse(storedValue))
            }
        } catch (error) {
            console.error("Error retrieving from localStorage:", error)
        } finally {
            setIsInitialized(true)
        }
    }, [key])

    useEffect(() => {
        if (typeof window === "undefined" || !isInitialized) return

        try {
            localStorage.setItem(key, JSON.stringify(state))
        } catch (error) {
            console.error("Error saving to localStorage:", error)
        }
    }, [key, state, isInitialized])

    return [state, setState, isInitialized] as const
}
