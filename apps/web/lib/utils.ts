import { env } from "@/env"
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

export function resolveSupabaseImageUrl(
    url: string | null | undefined
): string | undefined {
    if (!url) return undefined

    // Check if the URL points to Supabase storage
    if (url.includes("/storage/v1/object/public/")) {
        const storageIndex = url.indexOf("/storage/v1/object/public/")
        if (storageIndex !== -1) {
            const storagePath = url.substring(storageIndex)
            // Prepend Next.js Supabase URL env (e.g. http://localhost:18000)
            return `${env.NEXT_PUBLIC_SUPABASE_URL}${storagePath}`
        }
    }

    // Handle raw relative paths from Meilisearch (e.g. UUID/hash filenames)
    if (
        !url.startsWith("http://") &&
        !url.startsWith("https://") &&
        !url.startsWith("data:") &&
        !url.startsWith("/")
    ) {
        return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/favicons/${url}`
    }

    return url
}
