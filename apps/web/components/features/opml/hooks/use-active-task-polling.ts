import { RSS_QUERY_KEYS, useActiveImportTask } from "@readspace/shared"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo } from "react"

export function useActiveTaskPolling() {
    const queryClient = useQueryClient()
    const { data: activeTask } = useActiveImportTask()

    const activeImports = useMemo(
        () => (activeTask ? [activeTask] : []),
        [activeTask]
    )

    useEffect(() => {
        if (activeImports.length > 0) {
            const interval = setInterval(() => {
                queryClient.invalidateQueries({
                    queryKey: [RSS_QUERY_KEYS.OPML_IMPORT_TASKS],
                })
            }, 2000)

            return () => clearInterval(interval)
        }
    }, [activeImports.length, queryClient])

    return { activeImports }
}
