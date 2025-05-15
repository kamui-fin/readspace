"use client"

import {
    ChevronsUpDown,
    LogOut,
} from "lucide-react"
import { useState } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    SidebarLeftMenuButton,
    SidebarMenu,
    SidebarMenuItem,
    useSidebarLeft,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useCurrentUser } from "@/hooks/use-current-user"

interface NavUserProps {
    avatar: string
    name: string | null
    email: string | null
    handleSignOut: () => void
}

export function NavUser({ avatar, name, email, handleSignOut }: NavUserProps) {
    const { isMobile, toggleSidebar } = useSidebarLeft()
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

    const { user } = useCurrentUser()

    const loadingUser = !name || !email

    return (
        <>
            <SidebarMenu>
                <SidebarMenuItem>
                    <DropdownMenu
                        open={isUserMenuOpen}
                        onOpenChange={setIsUserMenuOpen}
                    >
                        <DropdownMenuTrigger asChild>
                            <SidebarLeftMenuButton
                                size="lg"
                                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                            >
                                {loadingUser ? (
                                    <>
                                        <Skeleton className="h-8 w-8 rounded-lg" />
                                        <div className="grid flex-1 gap-1 text-left">
                                            <Skeleton className="h-4 w-24" />
                                            <Skeleton className="h-3 w-32" />
                                        </div>
                                        <ChevronsUpDown className="ml-auto size-4 opacity-50" />
                                    </>
                                ) : (
                                    <>
                                        <Avatar className="h-8 w-8 rounded-lg">
                                            <AvatarImage
                                                src={avatar}
                                                alt={name}
                                            />
                                        </Avatar>
                                        <div className="grid flex-1 text-left text-sm leading-tight">
                                            <span className="truncate font-semibold">
                                                {name}
                                            </span>
                                            <span className="truncate text-xs">
                                                {email}
                                            </span>
                                        </div>
                                        <ChevronsUpDown className="ml-auto size-4" />
                                    </>
                                )}
                            </SidebarLeftMenuButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg z-9999"
                            side={isMobile ? "bottom" : "right"}
                            align="end"
                            sideOffset={4}
                        >
                            <DropdownMenuLabel className="p-0 font-normal">
                                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                    {loadingUser ? (
                                        <>
                                            <Skeleton className="h-8 w-8 rounded-lg" />
                                            <div className="grid flex-1 gap-1 text-left">
                                                <Skeleton className="h-4 w-24" />
                                                <Skeleton className="h-3 w-32" />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <Avatar className="h-8 w-8 rounded-lg">
                                                <AvatarImage
                                                    src={avatar}
                                                    alt={name}
                                                />
                                                <AvatarFallback className="rounded-lg">
                                                    {name
                                                        ?.slice(0, 2)
                                                        .toUpperCase() ?? ""}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="grid flex-1 text-left text-sm leading-tight">
                                                <span className="truncate font-semibold">
                                                    {name}
                                                </span>
                                                <span className="truncate text-xs">
                                                    {email}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                                <DropdownMenuItem onClick={handleSignOut}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Log out
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SidebarMenuItem>
            </SidebarMenu>
        </>
    )
}
