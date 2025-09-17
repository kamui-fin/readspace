"use client"

import { ChevronsUpDown, Clock, LogOut, Upload } from "lucide-react"
import { useState } from "react"

import { Avatar, AvatarImage } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
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
import Link from "next/link"
import ThemeSwitcher from "./theme-switcher"

interface NavUserProps {
    avatar: string
    name: string | null
    email: string | null
    handleSignOut: () => void
}

export function NavUser({ avatar, name, email, handleSignOut }: NavUserProps) {
    const { isMobile } = useSidebarLeft()
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

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
                            <DropdownMenuGroup>
                                <div className="px-2 py-1.5">
                                    <ThemeSwitcher />
                                </div>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                                <DropdownMenuItem asChild>
                                    <Link
                                        href="/import-opml"
                                        className="cursor-pointer"
                                    >
                                        <Upload className="mr-2 h-4 w-4" />
                                        Import OPML
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link
                                        href="/recently-read"
                                        className="cursor-pointer"
                                    >
                                        <Clock className="mr-2 h-4 w-4" />
                                        Recently Read
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
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
