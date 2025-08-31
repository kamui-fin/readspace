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
import { useIsMobile } from "@/hooks/use-mobile"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { User } from "@supabase/supabase-js"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { NavMain } from "./nav-main"
import { NavSecondary } from "./nav-secondary"
import { NavUser } from "./nav-user"
import Link from "next/link"

const data = {
    navSecondary: [
        {
            title: "Import OPML",
            url: "/import-opml",
            icon: function Upload(props: React.SVGProps<SVGSVGElement>) {
                return (
                    <svg
                        {...props}
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                )
            },
        },
        {
            title: "Feedback",
            url: "https://github.com/kamui-fin/readspace",
            icon: function Send(props: React.SVGProps<SVGSVGElement>) {
                return (
                    <svg
                        {...props}
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="m22 2-7 20-4-9-9-4Z" />
                        <path d="M22 2 11 13" />
                    </svg>
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
    const [user, setUser] = useState<User | null>(null)
    const supabase = createClient()
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)

    useEffect(() => {
        const getUser = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser()
            setUser(user)
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
                className={cn(props.className, { hidden: !user })}
            >
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarLeftMenuButton
                                asChild
                                className="data-[slot=sidebar-menu-button]:!p-1.5"
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
                                        Readspace
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
