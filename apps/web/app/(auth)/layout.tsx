"use client"

import { ThemedToaster } from "@/components/ui/ThemedToaster"
import Script from "next/script"

interface AuthLayoutProps {
    children: React.ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
    return (
        <>
            {/* Sign in with Apple JS — loaded here so AppleSignInButton can rely
                on window.AppleID being defined on both /login and /signup. */}
            <Script
                src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"
                strategy="afterInteractive"
            />
            {children}
            <ThemedToaster />
        </>
    )
}
