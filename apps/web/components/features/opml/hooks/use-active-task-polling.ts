import { useActiveImportTask } from "@readspace/shared"
import { useMemo } from "react"

export function useActiveTaskPolling() {
    const { data: activeTask } = useActiveImportTask()

    const activeImports = useMemo(
        () => (activeTask ? [activeTask] : []),
        [activeTask]
    )

    return { activeImports }
}
