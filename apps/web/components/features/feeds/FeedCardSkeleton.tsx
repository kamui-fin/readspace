import { Skeleton } from "@/components/ui/skeleton"

export function FeedCardSkeleton() {
    return (
        <div className="p-4">
            <div className="flex gap-4">
                <div className="relative">
                    <Skeleton className="w-9 h-9 rounded" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-3 w-1/3 mt-1 opacity-70" />
                            <Skeleton className="h-3 w-full mt-2 opacity-50" />
                        </div>

                        <div className="flex items-center gap-4 flex-shrink-0">
                            <Skeleton className="h-6 w-16 opacity-30" />
                            <Skeleton className="h-8 w-14" />
                        </div>
                    </div>

                    <Skeleton className="h-4 w-12 mt-2 opacity-30" />
                </div>
            </div>
        </div>
    )
}
