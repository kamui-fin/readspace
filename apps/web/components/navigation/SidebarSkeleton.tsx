import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"

export function SidebarFeedsSkeleton() {
    return (
        <>
            <div className="space-y-0.5">
                {/* All item skeleton */}
                <div className="flex items-center w-full py-1 px-2">
                    <div className="flex-1">
                        <Skeleton className="h-4 w-8 bg-accent dark:bg-muted" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-6 bg-accent dark:bg-muted" />
                    </div>
                </div>

                {/* Folder skeleton */}
                <div>
                    <div className="flex items-center w-full py-1 px-2">
                        <div className="flex-1 flex items-center">
                            <Skeleton className="h-4 w-20 ml-1 bg-accent dark:bg-muted" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-6 w-6 bg-accent dark:bg-muted" />
                        </div>
                    </div>

                    {/* Sub-items skeleton */}
                    <div className="ml-6 space-y-0.5">
                        <div className="flex items-center w-full py-0.5 px-2">
                            <div className="flex-1">
                                <Skeleton className="h-4 w-24 bg-accent dark:bg-muted" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-6 w-6 bg-accent dark:bg-muted" />
                            </div>
                        </div>
                        <div className="flex items-center w-full py-0.5 px-2">
                            <div className="flex-1">
                                <Skeleton className="h-4 w-20 bg-accent dark:bg-muted" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-6 w-6 bg-accent dark:bg-muted" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Individual feed skeletons */}
                <div className="flex items-center w-full py-1 px-2">
                    <div className="flex-1">
                        <Skeleton className="h-4 w-28 bg-accent dark:bg-muted" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-6 bg-accent dark:bg-muted" />
                    </div>
                </div>
            </div>
        </>
    )
}