"use client"

import { Switch } from "@/components/ui/switch"
import { MoonIcon, SunIcon, type LucideIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useId, useState } from "react"

import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export default function ThemeSwitcher() {
    const { setTheme, theme } = useTheme()

    const id = useId()
    const [isLight, setIsLight] = useState(theme === "light")

    const toggleSwitch = () => {
        setTheme(!isLight ? "light" : "dark")

        setIsLight((prev) => !prev)
    }

    return (
        <div
            className="group inline-flex items-center gap-2"
            data-state={isLight ? "checked" : "unchecked"}
        >
            <span
                id={`${id}-off`}
                className="group-data-[state=checked]:text-muted-foreground/70 flex-1 cursor-pointer text-right text-sm font-medium"
                aria-controls={id}
                onClick={() => setIsLight(false)}
            >
                <MoonIcon size={16} aria-hidden="true" />
            </span>
            <Switch
                id={id}
                checked={isLight}
                onCheckedChange={toggleSwitch}
                aria-labelledby={`${id}-off ${id}-on`}
                aria-label="Toggle between dark and light mode"
            />
            <span
                id={`${id}-on`}
                className="group-data-[state=unchecked]:text-muted-foreground/70 flex-1 cursor-pointer text-left text-sm font-medium"
                aria-controls={id}
                onClick={() => setIsLight(true)}
            >
                <SunIcon size={16} aria-hidden="true" />
            </span>
        </div>
    )
}

export function NavTheme({
    items,
    collapsed,
    ...props
}: {
    items: {
        name: string
        url: string
        icon: LucideIcon
        right?: React.ReactNode
    }[]
    collapsed?: boolean
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
    return (
        <SidebarGroup className="mt-auto" {...props}>
            <SidebarGroupContent>
                <SidebarMenu>
                    {items.map((item) => (
                        <SidebarMenuItem key={item.name}>
                            <div
                                className={cn(
                                    "flex items-center w-sm px-1",
                                    collapsed
                                        ? "justify-center"
                                        : "justify-between"
                                )}
                            >
                                <a
                                    href={item.url}
                                    className={cn(
                                        "flex items-center",
                                        collapsed
                                            ? "w-full justify-center"
                                            : "gap-3"
                                    )}
                                >
                                    <item.icon />
                                    {!collapsed && <span>{item.name}</span>}
                                </a>
                                {!collapsed && item.right}
                            </div>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}
