"use client"

import * as React from "react"

import {
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarLeft,
    SidebarLeftMenuButton,
    SidebarMenu,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@readspace/shared"
import { User } from "@supabase/supabase-js"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { NavMain } from "./nav-main"
import { NavSecondary } from "./nav-secondary"
import { NavUser } from "./nav-user"

const data = {
    navSecondary: [
        {
            title: "Github",
            url: "https://github.com/kamui-fin/readspace",
            icon: function Github() {
                return (
                    <>
                        <Image
                            src="/github-light.svg"
                            width={24}
                            height={24}
                            alt="Github"
                            className="w-4 h-4 dark:hidden"
                        />
                        <Image
                            src="/github-dark.svg"
                            width={24}
                            height={24}
                            alt="Github"
                            className="w-4 h-4 hidden dark:block"
                        />
                    </>
                )
            },
        },
        {
            title: "Join the Discord",
            url: "https://discord.gg/vmfafzqdX5",
            icon: function Discord() {
                return (
                    <Image
                        src="/discord.svg"
                        width={24}
                        height={24}
                        alt="Discord"
                        className="w-4 h-4"
                    />
                )
            },
        },
    ],
}

export function AppSidebar({
    ...props
}: React.ComponentProps<typeof SidebarLeft>) {
    const [user, setUser] = useState<User | null>(null)
    const [isLoadingUser, setIsLoadingUser] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        const getUser = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser()
            setUser(user)
            setIsLoadingUser(false)
        }
        getUser()
    }, [supabase])

    const handleSignOut = async () => {
        setUser(null)
        await supabase.auth.signOut()
        window.location.href = "/login"
    }

    const avatar = user?.user_metadata.avatar_url || "/notion-avatar.png"
    const name =
        user?.user_metadata?.full_name || user?.user_metadata?.display_name
    const email = user?.email || null
    return (
        <>
            <SidebarLeft
                variant="inset"
                collapsible="offcanvas"
                {...props}
                className={cn(props.className, {
                    hidden: !isLoadingUser && !user,
                })}
            >
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarLeftMenuButton
                                asChild
                                className="data-[slot=sidebar-menu-button]:!p-1.5 pl-2 py-2"
                            >
                                <Link href="/">
                                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                                        <Image
                                            src="/readspace.svg"
                                            width={30}
                                            height={30}
                                            alt=""
                                            className="rounded"
                                        />
                                    </div>
                                    <span className="truncate font-logo text-xl font-medium tracking-normal">
                                        readspace
                                    </span>
                                </Link>
                            </SidebarLeftMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>
                <SidebarContent>
                    <NavMain />
                    <NavSecondary
                        items={data.navSecondary}
                        className="mt-auto"
                    />
                </SidebarContent>
                <SidebarFooter>
                    <NavUser
                        avatar={avatar}
                        name={name}
                        email={email}
                        handleSignOut={handleSignOut}
                    />
                </SidebarFooter>
            </SidebarLeft>
        </>
    )
}
