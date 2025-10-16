import ClientLayout from "@/components/layout/ClientLayout"
import { AppSidebar } from "@/components/navigation/AppSidebar"
import { ReaderSidebar } from "@/components/reader/ReaderSidebar"
import { SidebarInset } from "@/components/ui/sidebar"

export default async function ProtectedLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <ClientLayout>
            <AppSidebar />
            <SidebarInset>{children}</SidebarInset>
            <ReaderSidebar />
        </ClientLayout>
    )
}
