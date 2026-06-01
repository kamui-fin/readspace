import {
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export function SidebarFeedsSkeleton() {
    return (
        <SidebarMenu>
            {/* "All" item skeleton */}
            <SidebarMenuItem>
                <div className="relative flex items-center w-full h-8 rounded-md px-1 pl-[28px] pointer-events-none">
                    <div className="flex items-center gap-2 flex-grow pl-1">
                        <Skeleton className="h-4 w-4 shrink-0 bg-sidebar-accent rounded-sm" />
                        <Skeleton className="h-4 w-12 bg-sidebar-accent rounded-sm" />
                    </div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 pr-1">
                        <Skeleton className="h-4 w-4 rounded-full bg-sidebar-accent/60" />
                        <Skeleton className="h-5 w-8 rounded-full bg-sidebar-accent/60" />
                    </div>
                </div>
            </SidebarMenuItem>

            {/* Collapsible folder skeleton */}
            <SidebarMenuItem>
                <div className="relative flex items-center w-full h-8 rounded-md px-1 pointer-events-none">
                    <button
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/40"
                        disabled
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <div className="flex items-center gap-2 flex-grow pl-1">
                        <Skeleton className="h-4 w-4 shrink-0 bg-sidebar-accent rounded-sm" />
                        <Skeleton className="h-4 w-24 bg-sidebar-accent rounded-sm" />
                    </div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 pr-1">
                        <Skeleton className="h-4 w-4 rounded-full bg-sidebar-accent/60" />
                        <Skeleton className="h-5 w-8 rounded-full bg-sidebar-accent/60" />
                    </div>
                </div>

                {/* Sub-items within folder */}
                <SidebarMenuSub>
                    {/* First sub-item */}
                    <SidebarMenuSubItem>
                        <div className="relative flex items-center w-full h-8 rounded-md px-1 pl-2 pointer-events-none">
                            <div className="flex items-center gap-2 flex-grow pl-1">
                                <Skeleton className="h-4 w-4 rounded-sm shrink-0 bg-sidebar-accent" />
                                <Skeleton className="h-4 w-32 bg-sidebar-accent" />
                            </div>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 pr-1">
                                <Skeleton className="h-4 w-4 rounded-full bg-sidebar-accent/60" />
                                <Skeleton className="h-5 w-6 rounded-full bg-sidebar-accent/60" />
                            </div>
                        </div>
                    </SidebarMenuSubItem>

                    {/* Second sub-item */}
                    <SidebarMenuSubItem>
                        <div className="relative flex items-center w-full h-8 rounded-md px-1 pl-2 pointer-events-none">
                            <div className="flex items-center gap-2 flex-grow pl-1">
                                <Skeleton className="h-4 w-4 rounded-sm shrink-0 bg-sidebar-accent" />
                                <Skeleton className="h-4 w-28 bg-sidebar-accent" />
                            </div>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 pr-1">
                                <Skeleton className="h-4 w-4 rounded-full bg-sidebar-accent/60" />
                                <Skeleton className="h-5 w-8 rounded-full bg-sidebar-accent/60" />
                            </div>
                        </div>
                    </SidebarMenuSubItem>
                </SidebarMenuSub>
            </SidebarMenuItem>

            {/* Regular feed item skeletons (feeds without folder) */}
            <SidebarMenuItem>
                <div className="relative flex items-center w-full h-8 rounded-md px-1 pl-[28px] pointer-events-none">
                    <div className="flex items-center gap-2 flex-grow pl-1">
                        <Skeleton className="h-4 w-4 rounded-sm shrink-0 bg-sidebar-accent" />
                        <Skeleton className="h-4 w-36 bg-sidebar-accent" />
                    </div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 pr-1">
                        <Skeleton className="h-4 w-4 rounded-full bg-sidebar-accent/60" />
                        <Skeleton className="h-5 w-7 rounded-full bg-sidebar-accent/60" />
                    </div>
                </div>
            </SidebarMenuItem>

            <SidebarMenuItem>
                <div className="relative flex items-center w-full h-8 rounded-md px-1 pl-[28px] pointer-events-none">
                    <div className="flex items-center gap-2 flex-grow pl-1">
                        <Skeleton className="h-4 w-4 rounded-sm shrink-0 bg-sidebar-accent" />
                        <Skeleton className="h-4 w-40 bg-sidebar-accent" />
                    </div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 pr-1">
                        <Skeleton className="h-4 w-4 rounded-full bg-sidebar-accent/60" />
                        <Skeleton className="h-5 w-6 rounded-full bg-sidebar-accent/60" />
                    </div>
                </div>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
