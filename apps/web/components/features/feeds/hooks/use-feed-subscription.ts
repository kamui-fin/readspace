import { useState } from "react"
import { useCreateFolder, useCreateFeed, ApiError } from "@readspace/shared"
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
    const [isCreatingFolder, setIsCreatingFolder] = useState(false)
    const [newFolderName, setNewFolderName] = useState("")

    const createFolder = useCreateFolder()
    const createFeed = useCreateFeed()

    const isSubmitting = createFolder.isPending || createFeed.isPending

    const handleSubscribe = async (feedId: string, feedUrl?: string) => {
        if (!isCreatingFolder && !selectedFolderId) {
            toast.error("Please select a folder")
            return
        }

        if (isCreatingFolder && !newFolderName.trim()) {
            toast.error("Please enter a folder name")
            return
        }

        try {
            let folderId = selectedFolderId

            if (isCreatingFolder) {
                const newFolder = await createFolder.mutateAsync({
                    name: newFolderName.trim(),
                })
                folderId = newFolder.id
            }

            if (!feedUrl) {
                throw new Error("Cannot subscribe: Missing Feed URL")
            }

            await createFeed.mutateAsync({
                url: feedUrl,
                folder_id: folderId,
            })

            toast.success("Successfully subscribed to feed")
            onSuccess?.()
            onClose()
            resetState()
        } catch (error: unknown) {
            if (error instanceof ApiError && error.status === 429) {
                return
            }
            const message =
                (error as { message?: string; detail?: string })?.message ||
                (error as { message?: string; detail?: string })?.detail ||
                "Failed to subscribe to feed"
            toast.error(message)
        }
    }

    const resetState = () => {
        setSelectedFolderId("")
        setIsCreatingFolder(false)
        setNewFolderName("")
    }

    return {
        selectedFolderId,
        setSelectedFolderId,
        isCreatingFolder,
        setIsCreatingFolder,
        newFolderName,
        setNewFolderName,
        handleSubscribe,
        resetState,
        isSubmitting,
    }
}
