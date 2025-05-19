"use client"

import { useRouter } from "next/navigation"
import * as React from "react"

import { FeedbackModal } from "@/components/feedback/feedback-modal"
import {
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarLeft,
    SidebarMenu,
    SidebarMenuItem,
    useSidebarLeft
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

const data = {
    navSecondary: [
        {
            title: "Support",
            url: "#",
            icon: function LifeBuoy(props: React.SVGProps<SVGSVGElement>) {
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
                        <circle cx="12" cy="12" r="4" />
                        <circle cx="12" cy="12" r="10" />
                        <path d="m4.93 4.93 4.24 4.24" />
                        <path d="m14.83 14.83 4.24 4.24" />
                        <path d="m14.83 9.17 4.24-4.24" />
                        <path d="m9.17 14.83-4.24 4.24" />
                    </svg>
                )
            },
        },
        {
            title: "Feedback",
            url: "#",
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

    const handleFeedbackClick = () => {
        setIsFeedbackModalOpen(true)
        if (isMobile) {
            toggleSidebar()
        }
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
                {...props}
                className={cn(props.className, { hidden: !user })}
                collapsible="icon"
            >
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem className="flex gap-2 items-center p-2 pl-0 pt-0">
                            <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                                <Image
                                    src="/readspace.svg"
                                    width={30}
                                    height={30}
                                    alt=""
                                    className="rounded"
                                />
                            </div>
                            <h1 className="truncate font-logo text-xl font-medium tracking-normal">Readspace</h1>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>
                <SidebarContent>
                    <NavMain />
                    <NavSecondary items={data.navSecondary} className="mt-auto" />
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

            <FeedbackModal
                isOpen={isFeedbackModalOpen}
                onClose={() => setIsFeedbackModalOpen(false)}
                userId={userId}
            />
        </>
    )
}
