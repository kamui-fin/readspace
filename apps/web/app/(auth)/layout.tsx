"use client"

import { ThemedToaster } from "@/components/ui/ThemedToaster"
import { Toaster } from "react-hot-toast"
import { useEffect, useState } from "react"

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
