"use client"

import { ThemedToaster } from "@/components/ui/ThemedToaster"

interface AuthLayoutProps {
    children: React.ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
    return (
        <>
            {children}
            <ThemedToaster />
        </>
    )
}
