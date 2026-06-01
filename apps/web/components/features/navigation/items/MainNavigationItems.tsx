"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    SidebarGroup,
    SidebarMenu,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useUnreadCounts } from "@readspace/shared"
import { cn } from "@/lib/utils"

interface MainNavItem {
    /** Display title for the navigation item */
    title: string
    /** Icon component for the navigation item */
    icon: React.ElementType
    /** URL path for navigation */
    url: string
}

interface MainNavigationItemsProps {
    /** Array of main navigation items */
    items: MainNavItem[]
}

/**
 * Main navigation items component for displaying top-level navigation links.
 * Includes special count handling for Today and Read Later items.
 */
export function MainNavigationItems({
    items,
}: MainNavigationItemsProps) {
    const pathname = usePathname()

    // Fetch unread counts for special items
    const { data: unreadCounts } = useUnreadCounts({
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 0, // Always consider stale so invalidation works immediately
    })

    const typedUnreadCounts =
        (unreadCounts as {
            read_later?: number
            today?: number
        }) || {}

    /**
     * Get unread count for specific navigation items
     */
    const getCountForItem = (title: string): number | null => {
        switch (title) {
            case "Today":
                return typedUnreadCounts.today || 0
            case "Read Later":
                return typedUnreadCounts.read_later || 0
            default:
                return null
        }
    }

    return (
        <SidebarGroup>
            <SidebarMenu>
                {items.map((item) => {
                    const count = getCountForItem(item.title)
                    const isActive = pathname === item.url

                    return (
                        <SidebarMenuItem key={item.title}>
                            <div className={cn(
                                "relative flex items-center w-full group/item h-8 rounded-md text-sm transition-colors duration-150 px-1 pl-2",
                                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            )}>
                                <Link
                                    href={item.url}
                                    aria-label={`Navigate to ${item.title}`}
                                    className="flex flex-grow items-center overflow-hidden h-full pr-10 outline-none select-none text-sidebar-foreground pl-1"
                                >
                                    <item.icon className="h-4 w-4 shrink-0" />
                                    <span className="ml-2 truncate">{item.title}</span>
                                </Link>

                                {/* Count badge for applicable items positioned absolutely on the right */}
                                {count != null && count > 0 && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none select-none flex items-center pr-1">
                                        <span className="text-xs font-semibold text-muted-foreground/80 px-1.5 py-0.5 rounded-full bg-muted/40 backdrop-blur-xs">
                                            {count}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </SidebarMenuItem>
                    )
                })}
            </SidebarMenu>
        </SidebarGroup>
    )
}

export type { MainNavItem }
