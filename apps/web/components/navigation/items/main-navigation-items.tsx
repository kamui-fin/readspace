"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    SidebarGroup,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
    useNavigationState,
    useOptimisticNavigation,
} from "@/hooks/use-navigation-state"
import { useUnreadCounts } from "@readspace/shared"

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
    /** Whether the interface is in mobile mode */
    isMobile: boolean
    /** Function to toggle sidebar on mobile */
    toggleSidebar: () => void
}

/**
 * Main navigation items component for displaying top-level navigation links.
 * Includes special count handling for Today and Read Later items.
 */
export function MainNavigationItems({
    items,
    isMobile,
    toggleSidebar,
}: MainNavigationItemsProps) {
    const pathname = usePathname()
    const { handleOptimisticClick } = useOptimisticNavigation()
    const { pendingPath } = useNavigationState()

    // Fetch unread counts for special items
    const { data: unreadCounts } = useUnreadCounts(undefined, {
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 0, // Always consider stale so invalidation works immediately
    })

    const typedUnreadCounts =
        (unreadCounts as {
            read_later_count?: number
            today_count?: number
        }) || {}

    /**
     * Get unread count for specific navigation items
     */
    const getCountForItem = (title: string): number | null => {
        switch (title) {
            case "Today":
                return typedUnreadCounts.today_count || 0
            case "Read Later":
                return typedUnreadCounts.read_later_count || 0
            default:
                return null
        }
    }

    return (
        <SidebarGroup>
            <SidebarMenu>
                {items.map((item) => {
                    const count = getCountForItem(item.title)
                    const isOptimisticallyActive = pendingPath === item.url
                    const isActiveState =
                        pathname === item.url || isOptimisticallyActive

                    return (
                        <SidebarMenuItem key={item.title}>
                            <div className="flex items-center w-full group/item">
                                <SidebarMenuButton
                                    asChild
                                    tooltip={item.title}
                                    isMobile={isMobile}
                                    toggleSidebar={toggleSidebar}
                                    isActive={isActiveState}
                                    className="flex-1 pl-2"
                                >
                                    <Link
                                        href={item.url}
                                        onClick={() =>
                                            handleOptimisticClick(item.url)
                                        }
                                        aria-label={`Navigate to ${item.title}`}
                                    >
                                        <item.icon className="h-4 w-4" />
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>

                                {/* Count badge for applicable items */}
                                <div className="shrink-0 flex items-center pr-2">
                                    {count != null && count > 0 && (
                                        <span className="ml-1 text-xs text-muted-foreground">
                                            {count}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </SidebarMenuItem>
                    )
                })}
            </SidebarMenu>
        </SidebarGroup>
    )
}

export type { MainNavItem }
