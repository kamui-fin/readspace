import {
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronRight } from "lucide-react"

export function SidebarFeedsSkeleton() {
    return (
        <SidebarMenu>
            {/* "All" item skeleton */}
            <SidebarMenuItem>
                <div className="relative flex items-center w-full h-8 rounded-md px-1 pl-2 pointer-events-none">
                    <div className="flex items-center flex-grow pl-1">
                        <Skeleton className="h-4 w-4 shrink-0 bg-sidebar-accent rounded-sm mr-1" />
                        <Skeleton className="h-4 w-12 bg-sidebar-accent rounded-sm ml-1" />
                    </div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                        <Skeleton className="h-4 w-6 bg-sidebar-accent/60 rounded-md" />
                    </div>
                </div>
            </SidebarMenuItem>

            {/* Collapsible folder skeleton */}
            <SidebarMenuItem>
                <div className="relative flex items-center w-full h-8 rounded-md px-1 pointer-events-none">
                    <div className="p-1 mr-1 text-muted-foreground/40 shrink-0">
                        <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex items-center flex-grow pl-1">
                        <Skeleton className="h-4 w-24 bg-sidebar-accent rounded-sm ml-1" />
                    </div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                        <Skeleton className="h-4 w-6 bg-sidebar-accent/60 rounded-md" />
                    </div>
                </div>

                {/* Sub-items within folder */}
                <SidebarMenuSub>
                    {/* First sub-item */}
                    <SidebarMenuSubItem>
                        <div className="relative flex items-center w-full h-8 rounded-md px-1 pl-2 pointer-events-none">
                            <div className="flex items-center flex-grow pl-1">
                                <Skeleton className="h-4 w-4 rounded-sm shrink-0 bg-sidebar-accent mr-2" />
                                <Skeleton className="h-4 w-32 bg-sidebar-accent rounded-sm" />
                            </div>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                                <Skeleton className="h-4 w-6 bg-sidebar-accent/60 rounded-md" />
                            </div>
                        </div>
                    </SidebarMenuSubItem>

                    {/* Second sub-item */}
                    <SidebarMenuSubItem>
                        <div className="relative flex items-center w-full h-8 rounded-md px-1 pl-2 pointer-events-none">
                            <div className="flex items-center flex-grow pl-1">
                                <Skeleton className="h-4 w-4 rounded-sm shrink-0 bg-sidebar-accent mr-2" />
                                <Skeleton className="h-4 w-28 bg-sidebar-accent rounded-sm" />
                            </div>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                                <Skeleton className="h-4 w-6 bg-sidebar-accent/60 rounded-md" />
                            </div>
                        </div>
                    </SidebarMenuSubItem>
                </SidebarMenuSub>
            </SidebarMenuItem>

            {/* Regular feed item skeletons (feeds without folder) */}
            <SidebarMenuItem>
                <div className="relative flex items-center w-full h-8 rounded-md px-1 pl-[28px] pointer-events-none">
                    <div className="flex items-center flex-grow pl-1">
                        <Skeleton className="h-4 w-4 rounded-sm shrink-0 bg-sidebar-accent mr-1" />
                        <Skeleton className="h-4 w-36 bg-sidebar-accent rounded-sm ml-1" />
                    </div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                        <Skeleton className="h-4 w-6 bg-sidebar-accent/60 rounded-md" />
                    </div>
                </div>
            </SidebarMenuItem>

            <SidebarMenuItem>
                <div className="relative flex items-center w-full h-8 rounded-md px-1 pl-[28px] pointer-events-none">
                    <div className="flex items-center flex-grow pl-1">
                        <Skeleton className="h-4 w-4 rounded-sm shrink-0 bg-sidebar-accent mr-1" />
                        <Skeleton className="h-4 w-40 bg-sidebar-accent rounded-sm ml-1" />
                    </div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                        <Skeleton className="h-4 w-6 bg-sidebar-accent/60 rounded-md" />
                    </div>
                </div>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
