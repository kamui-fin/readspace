import { createClient } from "@/lib/supabase/client"
import localforage from "localforage"
import { useEffect, useState } from "react"

/**
 * Custom hook to fetch a signed image URL from Supabase with caching via localForage.
 *
 * @param {string} path - The path of the image in storage
 * @param {number} expiresInSeconds - The lifetime (in seconds) for the signed URL, defaulting to 60 seconds
 * @returns {object} - An object containing the signed URL, loading state, and any error encountered
 */
export function useSignedImageUrl(
    path: string | null | undefined,
    expiresInSeconds = 3600
) {
    const [url, setUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        // If no path is provided, use placeholder
        if (!path) {
            setUrl("/placeholder.svg")
            setLoading(false)
            return
        }

        // If it's already a full URL, use it directly
        if (path.startsWith("http")) {
            setUrl(path)
            setLoading(false)
            return
        }

        const fetchSignedUrl = async () => {
            setLoading(true)
            // Construct a unique key based on the path
            const cacheKey = `signedUrl-${path}`
            try {
                // Try to get the cached URL from localforage
                const cachedData = await localforage.getItem(cacheKey)
                const currentTime = Date.now()

                // Check if a cached URL exists and hasn't expired
                if (
                    cachedData &&
                    (cachedData as any).signedUrl &&
                    (cachedData as any).expiration &&
                    currentTime < (cachedData as any).expiration
                ) {
                    setUrl((cachedData as any).signedUrl)
                } else {
                    // Initialize Supabase client
                    const supabase = createClient()

                    // Fetch a new signed URL from Supabase Storage
                    const { data, error } = await supabase.storage
                        .from("images")
                        .createSignedUrl(path, expiresInSeconds)

                    if (error) {
                        throw error
                    }

                    // Calculate an expiration timestamp
                    // Use 90% of the expiry time to be safe
                    const newExpiration =
                        currentTime + expiresInSeconds * 1000 * 0.9
                    const newSignedUrl = data.signedUrl

                    // Cache the signed URL along with its expiration timestamp
                    await localforage.setItem(cacheKey, {
                        signedUrl: newSignedUrl,
                        expiration: newExpiration,
                    })

                    setUrl(newSignedUrl)
                }
            } catch (err) {
                console.error("Error fetching signed URL:", err)

                // Fallback to public URL if signed URL fails
                try {
                    const supabase = createClient()
                    const { data } = supabase.storage
                        .from("images")
                        .getPublicUrl(path)

                    setUrl(data?.publicUrl || "/placeholder.svg")
                } catch (pubErr) {
                    setError(err as Error)
                    setUrl("/placeholder.svg")
                }
            }
            setLoading(false)
        }

        fetchSignedUrl()
    }, [path, expiresInSeconds])

    return { url, loading, error }
}
