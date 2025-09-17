import { Skeleton } from "@/components/ui/skeleton"

export function BookCardSkeleton() {
    return (
        <div className="h-full flex flex-col overflow-hidden bg-background rounded-lg">
            {/* Cover image skeleton */}
            <div className="aspect-[3/2] w-full relative rounded-t-lg overflow-hidden">
                <Skeleton className="w-full h-full" />
            </div>

            {/* Content skeleton */}
            <div className="flex-1 p-3 space-y-3">
                <div className="space-y-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-12 w-full" />
                <div className="flex">
                    <Skeleton className="h-5 w-16" />
                </div>
                <div className="flex justify-between items-center">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-16" />
                </div>
            </div>
            {/* Progress bar skeleton */}
            <Skeleton className="h-1 w-full rounded-none" />
        </div>
    )
}

export function BookCardListSkeleton() {
    return (
        <div className="bg-background rounded-lg border border-border/50 hover:border-border transition-colors">
            <div className="p-2 sm:p-4 flex gap-2 sm:gap-4">
                <Skeleton className="w-[60px] h-[90px] sm:w-[80px] sm:h-[120px] shrink-0 rounded" />
                <div className="flex-1 space-y-3">
                    <div className="space-y-1">
                        <Skeleton className="h-4 sm:h-5 w-3/4" />
                        <Skeleton className="h-3 sm:h-4 w-1/2" />
                    </div>
                    <Skeleton className="h-8 sm:h-12 w-full" />
                    <Skeleton className="h-4 w-16" />
                    <div className="flex justify-between">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-16" />
                    </div>
                </div>
            </div>
            <Skeleton className="h-1 w-full rounded-none" />
        </div>
    )
}
