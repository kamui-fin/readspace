"use client"

import { Toaster } from "react-hot-toast"
import { useEffect, useState } from "react"

export function ThemedToaster() {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return <Toaster position="top-center" />
    }

    return (
        <Toaster
            position="top-center"
            toastOptions={{
                style: {
                    background: "hsl(var(--background))",
                    color: "hsl(var(--foreground))",
                    border: "1px solid hsl(var(--border))",
                },
                success: {
                    style: {
                        background: "hsl(var(--background))",
                        color: "hsl(var(--foreground))",
                        border: "1px solid hsl(var(--border))",
                    },
                    iconTheme: {
                        primary: "hsl(var(--primary))",
                        secondary: "hsl(var(--primary-foreground))",
                    },
                },
                error: {
                    style: {
                        background: "hsl(var(--background))",
                        color: "hsl(var(--foreground))",
                        border: "1px solid hsl(var(--border))",
                    },
                    iconTheme: {
                        primary: "hsl(var(--destructive))",
                        secondary: "hsl(var(--destructive-foreground))",
                    },
                },
                loading: {
                    style: {
                        background: "hsl(var(--background))",
                        color: "hsl(var(--foreground))",
                        border: "1px solid hsl(var(--border))",
                    },
                },
            }}
        />
    )
}
