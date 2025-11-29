import { useEffect, useState } from "react"

export function usePersistedState<T>(key: string, initialValue: T): [T, (value: T) => void] {
    const [state, setState] = useState<T>(initialValue)

    useEffect(() => {
        try {
            const item = window.localStorage.getItem(key)
            if (item !== null) {
                // Handle cases where the stored value might not be JSON
                try {
                    setState(JSON.parse(item))
                } catch {
                    // Fallback for simple strings if JSON.parse fails
                    if (item === "true") setState(true as unknown as T)
                    else if (item === "false") setState(false as unknown as T)
                    else setState(item as unknown as T)
                }
            }
        } catch (error) {
            console.error("Error reading localStorage key:", key, error)
        }
    }, [key])

    const setValue = (value: T) => {
        try {
            setState(value)
            window.localStorage.setItem(key, JSON.stringify(value))
        } catch (error) {
            console.error("Error setting localStorage key:", key, error)
        }
    }

    return [state, setValue]
}
