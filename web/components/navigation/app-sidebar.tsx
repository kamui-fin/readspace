"use client"

import { useRouter } from "next/navigation"
import * as React from "react"

import {
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarLeft,
    SidebarLeftMenuButton,
    SidebarMenu,
    SidebarMenuItem,
    useSidebarLeft,
} from "@/components/ui/sidebar"
import { useIsMobile, useIsTablet } from "@/hooks/use-mobile"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { User } from "@supabase/supabase-js"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { NavMain } from "./nav-main"
import { NavSecondary } from "./nav-secondary"
import { NavUser } from "./nav-user"

const data = {
    navSecondary: [
        {
            title: "Github",
            url: "https://github.com/kamui-fin/readspace",
            icon: function Github(props: React.SVGProps<SVGSVGElement>) {
                return (
                    <>
                        <Image
                            src="/github-light.svg"
                            width={24}
                            height={24}
                            alt="Github"
                            className="w-4 h-4 dark:hidden"
                            {...props}
                        />
                        <Image
                            src="/github-dark.svg"
                            width={24}
                            height={24}
                            alt="Github"
                            className="w-4 h-4 hidden dark:block"
                            {...props}
                        />
                    </>
                )
            },
        },
        {
            title: "Join the Discord",
            url: "https://discord.gg/vmfafzqdX5",
            icon: function Discord(props: React.SVGProps<SVGSVGElement>) {
                return (
                    <Image
                        src="/discord.svg"
                        width={24}
                        height={24}
                        alt="Discord"
                        className="w-4 h-4"
                        {...props}
                    />
                )
            },
        },
    ],
}

export function AppSidebar({
    ...props
}: React.ComponentProps<typeof SidebarLeft>) {
    const { toggleSidebar } = useSidebarLeft()
    const pathname = usePathname()
    const router = useRouter()
    const isMobile = useIsMobile()
    const isTablet = useIsTablet()
    const [user, setUser] = useState<User | null>(null)
    const [isLoadingUser, setIsLoadingUser] = useState(true)
    const supabase = createClient()
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)

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
    const userId = user?.id || null
    return (
        <>
            <SidebarLeft
                variant="inset"
                collapsible="offcanvas"
                {...props}
                className={cn(props.className, { hidden: !isLoadingUser && !user })}
            >
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarLeftMenuButton
                                asChild
                                className="data-[slot=sidebar-menu-button]:!p-1.5 pl-2 py-2"
                            >
                                <Link
                                    href="/"
                                >
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
