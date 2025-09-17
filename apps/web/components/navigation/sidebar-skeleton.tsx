import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar"

export function SidebarFeedsSkeleton() {
    return (
        <>
            <div className="space-y-0.5">
                {/* All item skeleton */}
                <div className="flex items-center w-full py-1 px-2">
                    <div className="flex-1">
                        <div className="h-4 w-8 bg-muted-foreground/30 animate-pulse rounded" />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 bg-muted-foreground/30 animate-pulse rounded" />
                    </div>
                </div>

                {/* Folder skeleton */}
                <div>
                    <div className="flex items-center w-full py-1 px-2">
                        <div className="flex-1 flex items-center">
                            <div className="h-4 w-20 bg-muted-foreground/30 animate-pulse rounded ml-1" />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-6 bg-muted-foreground/30 animate-pulse rounded" />
                        </div>
                    </div>

                    {/* Sub-items skeleton */}
                    <div className="ml-6 space-y-0.5">
                        <div className="flex items-center w-full py-0.5 px-2">
                            <div className="flex-1">
                                <div className="h-4 w-24 bg-muted-foreground/30 animate-pulse rounded" />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-6 bg-muted-foreground/30 animate-pulse rounded" />
                            </div>
                        </div>
                        <div className="flex items-center w-full py-0.5 px-2">
                            <div className="flex-1">
                                <div className="h-4 w-20 bg-muted-foreground/30 animate-pulse rounded" />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-6 bg-muted-foreground/30 animate-pulse rounded" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Individual feed skeletons */}
                <div className="flex items-center w-full py-1 px-2">
                    <div className="flex-1">
                        <div className="h-4 w-28 bg-muted-foreground/30 animate-pulse rounded" />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 bg-muted-foreground/30 animate-pulse rounded" />
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
                        <div className="h-4 w-12 bg-muted-foreground/30 animate-pulse rounded ml-2" />
                    </div>
                </div>
            </div>
        </SidebarGroup>
    )
}
