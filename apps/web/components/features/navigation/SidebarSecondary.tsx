import Link from "next/link"
import type * as React from "react"
import { cn } from "@/lib/utils"

import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuItem,
} from "@/components/ui/sidebar"

export function SidebarSecondary({
    items,
    ...props
}: {
    items: {
        title: string
        url: string
        icon: React.ElementType
    }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
    return (
        <SidebarGroup {...props}>
            <SidebarGroupContent>
                <SidebarMenu>
                    {items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <div
                                className={cn(
                                    "relative flex items-center w-full group/item h-8 rounded-md text-sm transition-colors duration-150 px-1 pl-2",
                                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                )}
                            >
                                <Link
                                    href={item.url}
                                    className="flex flex-grow items-center overflow-hidden h-full pr-10 outline-none select-none text-sidebar-foreground pl-1"
                                >
                                    <item.icon className="h-4 w-4 shrink-0" />
                                    <span className="ml-2 truncate">
                                        {item.title}
                                    </span>
                                </Link>
                            </div>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}
