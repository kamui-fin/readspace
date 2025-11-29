"use client"

import { ThemeProvider } from "@/components/providers/ThemeProvider"
import { SidebarLeftProvider } from "@/components/ui/sidebar"
import { ThemedToaster } from "@/components/ui/ThemedToaster"
import { useEffect, useState } from "react"

interface ClientLayoutProps {
    children: React.ReactNode
}

export default function ClientLayout({ children }: ClientLayoutProps) {
    return (
        <ThemeProvider>
            <SidebarLeftProvider>
                {children}
                <ThemedToaster />
            </SidebarLeftProvider>
        </ThemeProvider>
    )
}
