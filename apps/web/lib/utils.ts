import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatDate(dateString: string): string {
    const date = Date.parse(dateString)
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date)
}

export function fuzzySearch<T>(
    items: T[],
    term: string,
    keys: (keyof T)[]
): T[] {
    if (!term) return items
    const lowerTerm = term.toLowerCase()
    return items.filter((item) =>
        keys.some((key) => {
            const value = item[key]
            if (typeof value === "string") {
                return value.toLowerCase().includes(lowerTerm)
            }
            return false
        })
    )
}
