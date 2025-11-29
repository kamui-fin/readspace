import { useState } from "react"
import { toast } from "sonner"
import { useRefreshFeed } from "@readspace/shared"

export function useDeepRefresh() {
    const [isRefreshing, setIsRefreshing] = useState(false)
    const refreshFeed = useRefreshFeed()

    const handleDeepRefresh = async (
        feedId: string | undefined,
        onComplete?: () => void | Promise<void>
    ) => {
        if (!feedId) return

        setIsRefreshing(true)
        toast.loading("Checking for new articles...", { id: "deep-refresh" })

        try {
            await refreshFeed.mutateAsync({ feedId, forceRefetch: true })

            if (onComplete) {
                await onComplete()
            }

            toast.success("Check complete! Articles updated.", {
                id: "deep-refresh",
            })
        } catch (error) {
            console.error("Deep refresh failed:", error)
            toast.error("Failed to check for new articles. Please try again.", {
                id: "deep-refresh",
            })
        } finally {
            setIsRefreshing(false)
        }
    }

    return {
        isRefreshing,
        handleDeepRefresh,
    }
}
