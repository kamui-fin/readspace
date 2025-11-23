"use client"

import ClientLayout from "@/components/layout/ClientLayout"
import { AppSidebar } from "@/components/navigation/AppSidebar"
import { SidebarInset } from "@/components/ui/sidebar"

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <ClientLayout>
            <AppSidebar />
            <SidebarInset>{children}</SidebarInset>
        </ClientLayout>
    )
}
