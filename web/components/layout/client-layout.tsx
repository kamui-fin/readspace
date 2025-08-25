'use client'

import { ThemeProvider } from "@/components/theme-provider"
import {
  SidebarLeftProvider,
  SidebarRightProvider,
} from "@/components/ui/sidebar"
import { Toaster } from "react-hot-toast"

interface ClientLayoutProps {
  children: React.ReactNode
}

export default function ClientLayout({
  children,
}: ClientLayoutProps) {
  return (
    <ThemeProvider>
      <SidebarLeftProvider>
        <SidebarRightProvider>
          {children}
          <Toaster position="top-center" />
        </SidebarRightProvider>
      </SidebarLeftProvider>
    </ThemeProvider>
  )
}
