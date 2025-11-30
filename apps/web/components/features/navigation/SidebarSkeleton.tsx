import {
    SidebarLeftMenuButton,
    SidebarLeftMenuSubButton,
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
                <div className="flex items-center w-full group/item">
                    <SidebarLeftMenuButton className="flex-1" asChild>
                        <div className="flex items-center gap-2">
                            <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                                <Skeleton className="h-4 w-4 bg-sidebar-accent" />
                            </div>
                            <Skeleton className="h-4 w-12 bg-sidebar-accent" />
                        </div>
                    </SidebarLeftMenuButton>
                    <div className="flex items-center gap-2 shrink-0 pr-2">
                        <Skeleton className="h-4 w-4 rounded-full bg-sidebar-accent" />
                        <Skeleton className="h-5 w-8 rounded-full bg-sidebar-accent" />
                    </div>
                </div>
            </SidebarMenuItem>

            {/* Collapsible folder skeleton */}
            <SidebarMenuItem>
                <div className="flex items-center w-full group/item">
                    <div className="flex items-center flex-1">
                        <button
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-transform duration-200"
                            disabled
                        >
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <SidebarLeftMenuButton className="flex-1" asChild>
                            <div className="flex items-center gap-2">
                                <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                                    <Skeleton className="h-4 w-4 bg-sidebar-accent" />
                                </div>
                                <Skeleton className="h-4 w-24 bg-sidebar-accent" />
                            </div>
                        </SidebarLeftMenuButton>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pr-2">
                        <Skeleton className="h-4 w-4 rounded-full bg-sidebar-accent" />
                        <Skeleton className="h-5 w-8 rounded-full bg-sidebar-accent" />
                    </div>
                </div>

                {/* Sub-items within folder */}
                <SidebarMenuSub>
                    {/* First sub-item */}
                    <SidebarMenuSubItem>
                        <div className="flex items-center w-full group/item">
                            <SidebarLeftMenuSubButton
                                className="flex-1"
                                asChild
                            >
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-4 rounded-sm shrink-0 bg-sidebar-accent" />
                                    <Skeleton className="h-4 w-32 bg-sidebar-accent" />
                                </div>
                            </SidebarLeftMenuSubButton>
                            <div className="flex items-center gap-2 shrink-0 pr-2">
                                <Skeleton className="h-4 w-4 rounded-full bg-sidebar-accent" />
                                <Skeleton className="h-5 w-6 rounded-full bg-sidebar-accent" />
                            </div>
                        </div>
                    </SidebarMenuSubItem>

                    {/* Second sub-item */}
                    <SidebarMenuSubItem>
                        <div className="flex items-center w-full group/item">
                            <SidebarLeftMenuSubButton
                                className="flex-1"
                                asChild
                            >
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-4 rounded-sm shrink-0 bg-sidebar-accent" />
                                    <Skeleton className="h-4 w-28 bg-sidebar-accent" />
                                </div>
                            </SidebarLeftMenuSubButton>
                            <div className="flex items-center gap-2 shrink-0 pr-2">
                                <Skeleton className="h-4 w-4 rounded-full bg-sidebar-accent" />
                                <Skeleton className="h-5 w-8 rounded-full bg-sidebar-accent" />
                            </div>
                        </div>
                    </SidebarMenuSubItem>
                </SidebarMenuSub>
            </SidebarMenuItem>

            {/* Regular feed item skeletons (feeds without folder) */}
            <SidebarMenuItem>
                <div className="flex items-center w-full group/item">
                    <SidebarLeftMenuButton className="flex-1" asChild>
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-4 rounded-sm shrink-0 bg-sidebar-accent" />
                            <Skeleton className="h-4 w-36 bg-sidebar-accent" />
                        </div>
                    </SidebarLeftMenuButton>
                    <div className="flex items-center gap-2 shrink-0 pr-2">
                        <Skeleton className="h-4 w-4 rounded-full bg-sidebar-accent" />
                        <Skeleton className="h-5 w-7 rounded-full bg-sidebar-accent" />
                    </div>
                </div>
            </SidebarMenuItem>

            <SidebarMenuItem>
                <div className="flex items-center w-full group/item">
                    <SidebarLeftMenuButton className="flex-1" asChild>
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-4 rounded-sm shrink-0 bg-sidebar-accent" />
                            <Skeleton className="h-4 w-40 bg-sidebar-accent" />
                        </div>
                    </SidebarLeftMenuButton>
                    <div className="flex items-center gap-2 shrink-0 pr-2">
                        <Skeleton className="h-4 w-4 rounded-full bg-sidebar-accent" />
                        <Skeleton className="h-5 w-6 rounded-full bg-sidebar-accent" />
                    </div>
                </div>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
