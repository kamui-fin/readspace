import ClientLayout from "@/components/layout/client-layout"
import { AppSidebar } from "@/components/navigation/app-sidebar"
import { ReaderSidebar } from "@/components/reader/reader-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <ClientLayout>
            <AppSidebar />
            <SidebarInset>
                {children}
            </SidebarInset>
            <ReaderSidebar />
        </ClientLayout>
    )
}
