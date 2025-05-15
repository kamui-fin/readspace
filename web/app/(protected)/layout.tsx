import BetaDiscountBanner from "@/components/beta-discount-banner"
import ClientLayout from "@/components/layout/client-layout"
import MobileWarning from "@/components/mobile-warning"
import { AppSidebar } from "@/components/navigation/app-sidebar"
import { ReaderSidebar } from "@/components/reader/reader-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import UpgradeDialog from "@/components/upgrade-dialog"

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <ClientLayout>
            <MobileWarning />
            <AppSidebar />
            <SidebarInset>
                <BetaDiscountBanner />
                {children}
            </SidebarInset>
            <ReaderSidebar />
            <UpgradeDialog />
        </ClientLayout>
    )
}
