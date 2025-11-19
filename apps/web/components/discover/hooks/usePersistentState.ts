import { useEffect, useState } from "react"

/**
 * Custom hook for persisting state to localStorage
 */
export function usePersistentState(key: string, initialValue: string) {
    const [state, setState] = useState(() => {
        if (typeof window === "undefined") return initialValue
        try {
            const storedValue = localStorage.getItem(key)
            return storedValue ? JSON.parse(storedValue) : initialValue
        } catch (error) {
            console.error("Error retrieving from localStorage:", error)
            return initialValue
        }
    })

    useEffect(() => {
        if (typeof window === "undefined") return
        try {
            localStorage.setItem(key, JSON.stringify(state))
        } catch (error) {
            console.error("Error saving to localStorage:", error)
        }
    }, [key, state])

    return [state, setState] as const
}
