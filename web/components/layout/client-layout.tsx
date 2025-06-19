"use client"

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
            <ThemeProvider>
                <SidebarLeftProvider>
                    <SidebarRightProvider>{children}</SidebarRightProvider>
                </SidebarLeftProvider>
            </ThemeProvider>
            <Toaster position="top-center" />
        </QueryClientProvider>
    )
}

export default ClientLayout
