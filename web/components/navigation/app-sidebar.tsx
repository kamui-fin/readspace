"use client"

import { BookOpen, MessageCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

import { FeedbackModal } from "@/components/feedback/feedback-modal"
import {
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarLeft,
    SidebarLeftMenuButton,
    SidebarMenu,
    SidebarMenuItem,
    SidebarSeparator,
    useSidebarLeft,
} from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { User } from "@supabase/supabase-js"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { NavMain } from "./nav-main"
import { NavUser } from "./nav-user"

const navLinks = {
    navMain: [
        {
            name: "Library",
            url: "/library",
            icon: BookOpen,
        },
        {
            name: "Feedback",
            icon: MessageCircle,
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

    const navMainItems = navLinks.navMain.map((item) => {
        if (item.name === "Feedback") {
            const { url, ...rest } = item
            return {
                ...rest,
                onClick: handleFeedbackClick,
                isActive: false,
                icon: (props: any) => <item.icon size={16} {...props} />,
                renderText: () => (
                    <span className="sidebar-menu-text group-data-[collapsible=icon]:hidden">
                        {item.name}
                    </span>
                ),
            }
        }
        if (item.name === "Library" && item.url) {
            const { url, ...rest } = item
            return {
                ...rest,
                onClick: () => {
                    if (isMobile) {
                        toggleSidebar()
                    }
                    router.push(url)
                },
                isActive: pathname.startsWith(url),
                icon: (props: any) => <item.icon size={16} {...props} />,
                renderText: () => (
                    <span className="sidebar-menu-text group-data-[collapsible=icon]:hidden">
                        {item.name}
                    </span>
                ),
            }
        }
        return {
            ...item,
            isActive: item.url ? pathname.startsWith(item.url) : false,
            icon: (props: any) => <item.icon size={16} {...props} />,
            renderText: () => (
                <span className="sidebar-menu-text group-data-[collapsible=icon]:hidden">
                    {item.name}
                </span>
            ),
        }
    })

    return (
        <>
            <SidebarLeft
                {...props}
                className={cn(props.className, { hidden: !user })}
                collapsible="icon"
            >
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarLeftMenuButton size="lg" asChild>
                                <Link href={"/library"}>
                                    <Image
                                        src="/readspace.svg"
                                        width={30}
                                        height={30}
                                        alt={""}
                                        className="rounded"
                                    />
                                    <h1 className="text-xl font-logo font-medium">
                                        Readspace
                                    </h1>
                                </Link>
                            </SidebarLeftMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>
                <SidebarContent className="flex flex-col">
                    <NavMain group="Platform" items={navMainItems as any} />
                </SidebarContent>
                <SidebarSeparator />
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
