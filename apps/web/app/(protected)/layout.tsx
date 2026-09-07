"use client"

import ClientLayout from "@/components/layout/ClientLayout"
import { AppSidebar } from "@/components/features/navigation/AppSidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { useUserRole } from "@/hooks/use-user-role"
import { isCloudProd } from "@/lib/is-cloud-prod"
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
    // Onboarding is a cloud-only flow — never gate self-hosted instances on it.
    const needsOnboarding =
        isCloudProd() && !!profile && !profile.is_onboarded

    useEffect(() => {
        if (!isLoading && needsOnboarding) {
            router.replace("/onboarding")
        }
    }, [needsOnboarding, isLoading, router])

    if (isLoading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader
                    variant="circular"
                    size="lg"
                    className="size-5 border-[3px] border-secondary border-t-transparent [animation:spin_0.45s_linear_infinite]"
                />
            </div>
        )
    }

    if (needsOnboarding) {
        return null
    }

    return (
        <ClientLayout>
            <AppSidebar />
            <SidebarInset>{children}</SidebarInset>
        </ClientLayout>
    )
}
