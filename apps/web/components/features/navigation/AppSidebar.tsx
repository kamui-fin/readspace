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
import { useUserLimits, UserRole } from "@readspace/shared"
import { useUpgradeDialog } from "@/stores/upgrade-dialog"
import { Sparkles } from "lucide-react"

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
    const { data: limitData } = useUserLimits()
    const { open: openUpgrade } = useUpgradeDialog()

    const handleSignOut = async () => {
        await supabase.auth.signOut({ scope: "local" })
        window.location.href = "/login"
    }

    const avatar = user?.user_metadata.avatar_url
    const name =
        user?.user_metadata?.full_name ||
        user?.user_metadata?.display_name ||
        null
    const email = user?.email || null

    const isBasicUser = limitData?.role === UserRole.BASIC

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
                                className="data-[slot=sidebar-menu-button]:!p-1.5 pl-2 pr-3 py-2 w-full hover:!bg-transparent active:!bg-transparent"
                            >
                                <Link
                                    href="/today"
                                    className="flex items-center justify-between w-full"
                                >
                                    <Logo
                                        showText={true}
                                        iconSize={30}
                                        textSize="text-xl pb-[2px]"
                                    />
                                    {limitData?.role === UserRole.PRO && (
                                        <div className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 dark:border-orange-500/30 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase select-none shadow-xs">
                                            <Sparkles className="size-2.5 text-amber-500 dark:text-amber-400" />
                                            <span className="bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-300 bg-clip-text text-transparent">
                                                Pro
                                            </span>
                                        </div>
                                    )}
                                    {limitData?.role === UserRole.ADMIN && (
                                        <div className="inline-flex items-center bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-bold tracking-wider uppercase rounded-md px-1.5 py-0.5 text-[9px] select-none">
                                            Admin
                                        </div>
                                    )}
                                </Link>
                            </SidebarLeftMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarMain />

                    {isBasicUser && (
                        <div className="mx-3 mt-auto mb-2 p-3 rounded-lg border border-border/80 dark:border-zinc-800 bg-background transition-all duration-200">
                            <h4 className="text-[12px] font-semibold text-foreground tracking-tight">
                                Upgrade to Pro
                            </h4>
                            <p className="text-[10.5px] text-muted-foreground mt-0.5 mb-2.5">
                                Get unlimited feeds and unlock all features.
                            </p>
                            <button
                                onClick={() =>
                                    openUpgrade({
                                        title: "Upgrade to Readspace Pro",
                                        description:
                                            "Unlock unlimited feeds, advanced AI features, and seamless syncing.",
                                    })
                                }
                                className="text-[11px] font-semibold text-primary hover:text-primary/85 transition-colors cursor-pointer select-none text-left w-fit block p-0"
                            >
                                Upgrade &rarr;
                            </button>
                        </div>
                    )}

                    <SidebarSecondary
                        items={data.navSecondary}
                        className={isBasicUser ? "mt-0" : "mt-auto"}
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
