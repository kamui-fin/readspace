import { RSS_QUERY_KEYS, useImportTaskStatus, useCancelImportTask } from "@readspace/shared"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { toast } from "react-hot-toast"
import { useRouter } from "next/navigation"

export function useOpmlTaskStatus(taskId: string) {
    const queryClient = useQueryClient()
    const router = useRouter()
    const {
        data: task,
        isLoading,
        error,
    } = useImportTaskStatus(taskId)

    const cancelImportMutation = useCancelImportTask()

    useEffect(() => {
        // Poll every 2 seconds while task is running
        if (task && task.status === "in_progress") {
            const interval = setInterval(() => {
                queryClient.invalidateQueries({
                    queryKey: [RSS_QUERY_KEYS.OPML_IMPORT_STATUS, taskId],
                })
            }, 2000)

            return () => clearInterval(interval)
        }
    }, [task, taskId, queryClient])

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
        isCancelling: cancelImportMutation.isPending
    }
}
