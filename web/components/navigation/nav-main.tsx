"use client"

import { cn } from "@/lib/utils"
import { type LucideIcon } from "lucide-react"
import Link from "next/link"
import React, { useState } from "react"

import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarLeftMenuButton,
    SidebarMenu,
    SidebarMenuItem,
} from "@/components/ui/sidebar"

// Define the item type more explicitly
type NavItem = {
    name: string
    icon: LucideIcon
    isActive: boolean
    right?: React.ReactNode
    renderText?: () => React.ReactNode
} & ({ url: string; onClick?: never } | { url?: never; onClick: () => void }) // Either url or onClick

type NavMainProps = {
    group: string
    action?: React.ReactNode
    grow?: boolean // New prop to indicate this NavMain section should grow
} & (
    | { items: NavItem[]; component?: never }
    | { items?: never; component: React.ReactNode }
)

export function NavMain({
    group,
    items,
    component,
    action,
    grow,
}: NavMainProps) {
    const [isGroupHovered, setIsGroupHovered] = useState(false)

    return (
        <SidebarGroup
            className={cn(
                grow && "flex flex-col flex-grow min-h-0" // SidebarGroup grows and becomes a flex column
            )}
        >
            <div
                className="flex items-center justify-between pr-2"
                onMouseEnter={() => setIsGroupHovered(true)}
                onMouseLeave={() => setIsGroupHovered(false)}
            >
                <SidebarGroupLabel>{group}</SidebarGroupLabel>
                {action && isGroupHovered && (
                    <div className="flex items-center">{action}</div>
                )}
            </div>
            {/* SidebarMenu should also allow its content to grow if 'grow' is true and it's rendering a component */}
            <SidebarMenu
                className={cn(
                    grow && component && "flex flex-col flex-grow min-h-0"
                )}
            >
                {component ? (
                    <>{component}</> // RecentChats will be styled to grow within this flex container
                ) : (
                    // Otherwise render items
                    items?.map((item) => (
                        <SidebarMenuItem key={item.name}>
                            {item.url ? ( // If it has a URL, render a Link
                                <Link href={item.url} passHref legacyBehavior>
                                    <SidebarLeftMenuButton
                                        isActive={item.isActive}
                                        tooltip={item.name}
                                        className="px-4 py-5 flex items-center justify-between"
                                    >
                                        <span className="flex items-center gap-2">
                                            {item.icon && <item.icon />}
                                            {item.renderText ? (
                                                item.renderText()
                                            ) : (
                                                <span>{item.name}</span>
                                            )}
                                        </span>
                                        {item.right && (
                                            <span className="ml-2 flex-shrink-0">
                                                {item.right}
                                            </span>
                                        )}
                                    </SidebarLeftMenuButton>
                                </Link>
                            ) : (
                                // If it has onClick, render a Button
                                <SidebarLeftMenuButton
                                    isActive={item.isActive}
                                    tooltip={item.name}
                                    className="px-4 py-5 flex items-center justify-between"
                                    onClick={item.onClick} // Attach onClick handler
                                >
                                    <span className="flex items-center gap-2">
                                        {item.icon && <item.icon />}
                                        {item.renderText ? (
                                            item.renderText()
                                        ) : (
                                            <span>{item.name}</span>
                                        )}
                                    </span>
                                    {item.right && (
                                        <span className="ml-2 flex-shrink-0">
                                            {item.right}
                                        </span>
                                    )}
                                </SidebarLeftMenuButton>
                            )}
                        </SidebarMenuItem>
                    ))
                )}
            </SidebarMenu>
        </SidebarGroup>
    )
}
