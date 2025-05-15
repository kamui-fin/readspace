"use client"

import { Progress } from "@/components/ui/progress"
import { useReaderStore } from "@/stores/reader"

interface ReadingProgressBarProps {
    id?: string
}

export default function ReadingProgressBar({ id }: ReadingProgressBarProps) {
    const progress = useReaderStore((state) => state.progressPercentage)

    return (
        <div
            id={id}
            className="fixed top-0 left-0 right-0 z-11 will-change-transform"
        >
            <Progress
                value={progress}
                className="h-1 w-full rounded-none bg-gray-200 dark:bg-sidebar"
                indicatorClassName="bg-linear-to-r from-secondary to-primary transition-all duration-300 ease-in-out"
            />
        </div>
    )
}
