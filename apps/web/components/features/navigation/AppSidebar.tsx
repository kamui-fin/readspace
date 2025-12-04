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
import { cn } from "@/lib/utils"
import Image from "next/image"
import Link from "next/link"
import { SidebarMain } from "./SidebarMain"
import { SidebarSecondary } from "./SidebarSecondary"
import { Logo } from "@/components/ui/logo"
import { SidebarUser } from "./SidebarUser"

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
            url: "https://discord.com/invite/2Q5PtYwUQZ",
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

import { useCurrentUser } from "@/hooks/use-current-user"

export function AppSidebar({
    ...props
}: React.ComponentProps<typeof SidebarLeft>) {
    const { user, isLoading: isLoadingUser } = useCurrentUser()
    const supabase = createClient()

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        window.location.href = "/login"
    }

    const avatar = user?.user_metadata.avatar_url
    const name =
        user?.user_metadata?.full_name ||
        user?.user_metadata?.display_name ||
        null
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
                                <Link
                                    href="/today"
                                    className="flex items-center"
                                >
                                    <Logo
                                        showText={true}
                                        iconSize={30}
                                        textSize="text-xl pb-[2px]"
                                    />
                                </Link>
                            </SidebarLeftMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarMain />
                    <SidebarSecondary
                        items={data.navSecondary}
                        className="mt-auto"
                    />
                </SidebarContent>
                <SidebarFooter>
                    <SidebarUser
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
