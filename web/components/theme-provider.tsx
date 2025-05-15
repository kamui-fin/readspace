"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import * as React from "react"
import { useEffect, useState } from "react"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return <>{children}</> // Render children without ThemeProvider during SSR
    }

    return (
        <NextThemesProvider forcedTheme="light" attribute="class">
            {children}
        </NextThemesProvider>
    ) // Wrap children with ThemeProvider after mount
}
