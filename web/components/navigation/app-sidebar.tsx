"use client"

import { BookOpen, Clock, Layers, MessageCircle, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

import { FeedbackModal } from "@/components/feedback/feedback-modal"
import { NavMain } from "@/components/navigation/nav-main"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { useFlashcardSession } from "@/providers/flashcard-session"
import { User } from "@supabase/supabase-js"
import { CircleAlert } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import readspace from "../../public/readspace.svg"
import { NavUser } from "./nav-user"
import { RecentChats, useRemoveAllChats } from "./recent-chats"

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
    navSrs: [
        {
            name: "Due Today",
            icon: Clock,
            url: "/srs/due-today",
        },
        {
            name: "My Decks",
            icon: Layers,
            url: "/srs/decks",
        },
    ],
    // navSecondary: [
    //     {
    //         name: "Theme",
    //         url: "#",
    //         icon: SunMoon,
    //         right: <ThemeSwitcher />,
    //     },
    // ],
}

export function AppSidebar({
    ...props
}: React.ComponentProps<typeof SidebarLeft>) {
    const { toggleSidebar, state } = useSidebarLeft()
    const pathname = usePathname()
    const router = useRouter()
    const isMobile = useIsMobile()
    const [user, setUser] = useState<User | null>(null)
    const supabase = createClient()
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)
    const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false)
    const { removeAllChats, hasChats } = useRemoveAllChats()
    const { data: flashcardSessionData, isLoading: isFlashcardLoading } =
        useFlashcardSession()

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

    const navSrsWithActive = navLinks.navSrs.map((item) => {
        const { url, ...rest } = item
        let right = undefined
        if (item.name === "Due Today") {
            right =
                !isFlashcardLoading &&
                flashcardSessionData?.stats?.total > 0 ? (
                    <Badge
                        variant="secondary"
                        className="ml-2 min-w-6 text-center"
                    >
                        {flashcardSessionData.stats.total}
                    </Badge>
                ) : undefined
        }
        if (!url) {
            return {
                ...rest,
                right,
                onClick: () => {},
                isActive: false,
                icon: (props: any) => <item.icon size={16} {...props} />,
                renderText: () => (
                    <span className="sidebar-menu-text group-data-[collapsible=icon]:hidden">
                        {item.name}
                    </span>
                ),
            }
        }
        return {
            ...rest,
            right,
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
    })

    const handleClearAllChats = () => {
        setIsDeleteAllOpen(true)
    }

    const confirmClearAllChats = () => {
        removeAllChats()
        setIsDeleteAllOpen(false)
    }

    const RemoveAllChatsButton = () => {
        if (!hasChats) return null

        return (
            <Button
                variant="ghost"
                size="icon"
                onClick={handleClearAllChats}
                className="h-5 w-5 p-0 rounded-full text-muted-foreground hover:text-destructive"
                title="Remove all chats"
            >
                <Trash2 className="h-3 w-3" />
            </Button>
        )
    }

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
                                        src={readspace}
                                        width={30}
                                        height={30}
                                        alt={""}
                                        className="rounded"
                                    />
                                    <div className="flex flex-col gap-0.5 leading-none">
                                        <span className="font-semibold">
                                            Readspace
                                        </span>
                                        <span className="text-gray-500 pt-0.5">
                                            Learn. Retain. Grow
                                        </span>
                                    </div>
                                </Link>
                            </SidebarLeftMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>
                <SidebarContent className="flex flex-col">
                    <NavMain group="Platform" items={navMainItems as any} />
                    <NavMain
                        group="Flashcards"
                        items={navSrsWithActive as any}
                    />
                    <NavMain
                        grow={true}
                        group="Recent Chats"
                        component={<RecentChats />}
                        action={<RemoveAllChatsButton />}
                    />
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
                onOpenChange={setIsFeedbackModalOpen}
                userId={userId}
                userEmail={email}
            />

            <AlertDialog
                open={isDeleteAllOpen}
                onOpenChange={setIsDeleteAllOpen}
            >
                <AlertDialogContent>
                    <div className="flex flex-col gap-2 max-sm:items-center sm:flex-row sm:gap-4">
                        <div
                            className="flex size-9 shrink-0 items-center justify-center rounded-full border"
                            aria-hidden="true"
                        >
                            <CircleAlert className="opacity-80" size={16} />
                        </div>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                Remove All Chats
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to remove all chats? This
                                action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            onClick={() => setIsDeleteAllOpen(false)}
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmClearAllChats}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Remove All
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
