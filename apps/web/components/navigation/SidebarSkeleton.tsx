import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"

export function SidebarFeedsSkeleton() {
    return (
        <>
            <div className="space-y-0.5">
                {/* All item skeleton */}
                <div className="flex items-center w-full py-1 px-2">
                    <div className="flex-1">
                        <Skeleton className="h-4 w-8" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-6" />
                    </div>
                </div>

                {/* Folder skeleton */}
                <div>
                    <div className="flex items-center w-full py-1 px-2">
                        <div className="flex-1 flex items-center">
                            <Skeleton className="h-4 w-20 ml-1" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-6 w-6" />
                        </div>
                    </div>

                    {/* Sub-items skeleton */}
                    <div className="ml-6 space-y-0.5">
                        <div className="flex items-center w-full py-0.5 px-2">
                            <div className="flex-1">
                                <Skeleton className="h-4 w-24" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-6 w-6" />
                            </div>
                        </div>
                        <div className="flex items-center w-full py-0.5 px-2">
                            <div className="flex-1">
                                <Skeleton className="h-4 w-20" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-6 w-6" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Individual feed skeletons */}
                <div className="flex items-center w-full py-1 px-2">
                    <div className="flex-1">
                        <Skeleton className="h-4 w-28" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-6" />
                    </div>
                </div>
            </div>
        </>
    )
}

export function SidebarLibrarySkeleton() {
    return (
        <SidebarGroup>
            <SidebarGroupLabel>Other reading</SidebarGroupLabel>
            <div className="py-1.5 px-2">
                <div className="flex items-center">
                    <div className="flex-1">
                        <Skeleton className="h-4 w-12 ml-2" />
                    </div>
                </div>
            </div>
        </SidebarGroup>
    )
}
