"use client"

import ClientLayout from "@/components/layout/ClientLayout"
import { AppSidebar } from "@/components/features/navigation/AppSidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { useUserRole } from "@/hooks/use-user-role"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loader } from "@/components/ui/loader"

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { profile, isLoading } = useUserRole()
    const router = useRouter()

    useEffect(() => {
        if (!isLoading && profile && !profile.is_onboarded) {
            router.replace("/onboarding")
        }
    }, [profile, isLoading, router])

    if (isLoading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader variant="classic" size="lg" />
            </div>
        )
    }

    if (profile && !profile.is_onboarded) {
        return null
    }

    return (
        <ClientLayout>
            <AppSidebar />
            <SidebarInset>{children}</SidebarInset>
        </ClientLayout>
    )
}
