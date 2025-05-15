"use client"

import { PostHogProvider } from "@/app/providers"
import { ThemeProvider } from "@/components/theme-provider"
import {
    SidebarLeftProvider,
    SidebarRightProvider,
} from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { FlashcardSessionProvider } from "@/providers/flashcard-session"
import { HistoryProvider } from "@/providers/history"
import { trpc } from "@/utils/trpc"
import { TourProvider } from "@/components/tour"

interface ClientLayoutProps {
    children: React.ReactNode
}

// Client component for providers
function ClientLayout({ children }: ClientLayoutProps) {
    return (
        <PostHogProvider>
            <ThemeProvider>
                <TourProvider>
                    <SidebarLeftProvider>
                        <SidebarRightProvider>
                            <HistoryProvider>
                                <FlashcardSessionProvider>
                                    {children}
                                </FlashcardSessionProvider>
                            </HistoryProvider>
                        </SidebarRightProvider>
                    </SidebarLeftProvider>
                </TourProvider>
            </ThemeProvider>
            <Toaster />
        </PostHogProvider>
    )
}

export default trpc.withTRPC(ClientLayout) as typeof ClientLayout
