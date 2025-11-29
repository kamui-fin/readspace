import { useState } from "react"
import {
    useCreateFolder,
    useRefreshFeed,
    useSubscribeToFeed,
} from "@readspace/shared"
import { toast } from "react-hot-toast"

interface UseFeedSubscriptionProps {
    onSuccess?: () => void
    onClose: () => void
}

export function useFeedSubscription({
    onSuccess,
    onClose,
}: UseFeedSubscriptionProps) {
    const [selectedFolderId, setSelectedFolderId] = useState<string>("")
    const [error, setError] = useState<string | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [isCreatingFolder, setIsCreatingFolder] = useState(false)
    const [newFolderName, setNewFolderName] = useState("")

    const subscribeToFeed = useSubscribeToFeed()
    const refreshFeed = useRefreshFeed()
    const createFolder = useCreateFolder()

    const handleSubscribe = async (feedId: string) => {
        setError(null)

        if (!isCreatingFolder && !selectedFolderId) {
            setError("Please select a folder")
            return
        }

        if (isCreatingFolder && !newFolderName.trim()) {
            setError("Please enter a folder name")
            return
        }

        try {
            let folderId = selectedFolderId

            // Create folder first if needed
            if (isCreatingFolder) {
                const newFolder = await createFolder.mutateAsync({
                    name: newFolderName.trim(),
                })
                folderId = newFolder.id
            }

            // Then refresh the feed to get latest articles
            setIsRefreshing(true)

            await refreshFeed.mutateAsync({
                feedId: feedId,
                forceRefetch: true,
            })

            setIsRefreshing(false)

            // Create the subscription
            await subscribeToFeed.mutateAsync({
                feedId: feedId,
                folderId: folderId,
            })

            toast.success("Successfully subscribed to feed")
            onSuccess?.()
            onClose()
            setSelectedFolderId("")
            setIsCreatingFolder(false)
            setNewFolderName("")
            setError(null)
        } catch (error: unknown) {
            setIsRefreshing(false)

            let errorMessage = "Failed to subscribe to feed"
            if (typeof error === "string") {
                errorMessage = error
            } else if (error instanceof Error) {
                errorMessage = error.message
            } else if (error && typeof error === "object") {
                if (
                    "message" in error &&
                    typeof (error as { message: unknown }).message === "string"
                ) {
                    errorMessage = (error as { message: string }).message
                } else if (
                    "detail" in error &&
                    typeof (error as { detail: unknown }).detail === "string"
                ) {
                    errorMessage = (error as { detail: string }).detail
                }
            }
            setError(errorMessage)
        }
    }

    const resetState = () => {
        setSelectedFolderId("")
        setIsCreatingFolder(false)
        setNewFolderName("")
        setError(null)
    }

    return {
        selectedFolderId,
        setSelectedFolderId,
        error,
        setError,
        isRefreshing,
        isCreatingFolder,
        setIsCreatingFolder,
        newFolderName,
        setNewFolderName,
        handleSubscribe,
        resetState,
        isSubmitting:
            subscribeToFeed.isPending || isRefreshing || createFolder.isPending,
        createFolderPending: createFolder.isPending,
        subscribePending: subscribeToFeed.isPending,
    }
}
