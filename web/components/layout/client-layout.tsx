"use client"

import { PostHogProvider } from "@/app/providers"
import { ThemeProvider } from "@/components/theme-provider"
import {
    SidebarLeftProvider,
    SidebarRightProvider,
} from "@/components/ui/sidebar"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "react-hot-toast"

interface ClientLayoutProps {
    children: React.ReactNode
}

// Create a client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            retry: 1,
        },
    },
})

// Client component for providers
function ClientLayout({ children }: ClientLayoutProps) {
    return (
        <QueryClientProvider client={queryClient}>
            <PostHogProvider>
                <ThemeProvider>
                    <SidebarLeftProvider>
                        <SidebarRightProvider>{children}</SidebarRightProvider>
                    </SidebarLeftProvider>
                </ThemeProvider>
                <Toaster
                    position="top-center"
                    toastOptions={{
                        duration: 4000,
                        style: {
                            background: "var(--background)",
                            color: "var(--foreground)",
                            border: "1px solid var(--border)",
                        },
                        success: {
                            duration: 2000,
                            iconTheme: {
                                primary: "var(--success)",
                                secondary: "var(--background)",
                            },
                        },
                        error: {
                            duration: 4000,
                            iconTheme: {
                                primary: "var(--destructive)",
                                secondary: "var(--background)",
                            },
                        },
                    }}
                />
            </PostHogProvider>
        </QueryClientProvider>
    )
}

export default ClientLayout
