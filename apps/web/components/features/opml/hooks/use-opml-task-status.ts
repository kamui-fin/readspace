import { useImportTaskStatus, useCancelImportTask } from "@readspace/shared"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"

export function useOpmlTaskStatus(taskId: string) {
    const router = useRouter()
    const { data: task, isLoading, error } = useImportTaskStatus(taskId)

    const cancelImportMutation = useCancelImportTask()

    const handleCancelImport = async () => {
        try {
            const response = await cancelImportMutation.mutateAsync(taskId)

            // Check if cancellation was successful
            if (response.cancelled) {
                toast.success("Import cancelled successfully")
                router.push("/import-opml")
            } else {
                toast.success(response.message || "Task was already completed")
                router.push("/import-opml")
            }
        } catch (error) {
            console.error("Error cancelling import task:", error)
            toast.error(
                "Failed to cancel import. It may have already completed."
            )
        }
    }

    return {
        task,
        isLoading,
        error,
        handleCancelImport,
        isCancelling: cancelImportMutation.isPending,
    }
}
