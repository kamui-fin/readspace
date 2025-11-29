"use client"

import { Button } from "@/components/ui/button"
import { SidebarLeftTrigger } from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/useMobile"
import { AlertCircle, AlertTriangle, RefreshCw, WifiOff } from "lucide-react"
import { useRouter } from "next/navigation"

interface ArticlesErrorStateProps {
    error: Error | null
    onRetry?: () => void
}

/**
 * Dedicated error state component for article viewing errors
 * Handles different error types with appropriate messaging and actions
 */
export function ArticlesErrorState({
    error,
    onRetry,
}: ArticlesErrorStateProps) {
    const isMobile = useIsMobile()
    const router = useRouter()

    // Parse error to determine type
    const errorMessage = error?.message || "Unknown error"
    const is404 =
        errorMessage.toLowerCase().includes("not found") ||
        errorMessage.includes("404")
    const isNetworkError =
        errorMessage.toLowerCase().includes("network") ||
        errorMessage.toLowerCase().includes("fetch")

    // Determine appropriate icon, title, and description
    const getErrorContent = () => {
        if (is404) {
            return {
                icon: AlertCircle,
                title: "Feed Not Found",
                description:
                    "This feed doesn't exist or you don't have access to it.",
                iconColor: "text-destructive",
                action: (
                    <Button
                        variant="outline"
                        onClick={() => router.push("/today")}
                        className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                    >
                        View today&apos;s articles
                    </Button>
                ),
            }
        }

        if (isNetworkError) {
            return {
                icon: WifiOff,
                title: "Connection Error",
                description:
                    "We couldn&apos;t load the articles. Please try again later.",
                iconColor: "text-orange-500",
                action: onRetry ? (
                    <Button
                        variant="outline"
                        onClick={onRetry}
                        className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                    </Button>
                ) : null,
            }
        }

        // Generic error
        return {
            icon: AlertTriangle,
            title: "Something Went Wrong",
            description:
                errorMessage ||
                "An unexpected error occurred while loading articles.",
            iconColor: "text-yellow-500",
            action: onRetry ? (
                <Button
                    variant="outline"
                    onClick={onRetry}
                    className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                </Button>
            ) : null,
        }
    }

    const {
        icon: Icon,
        title,
        description,
        iconColor,
        action,
    } = getErrorContent()

    return (
        <div className="flex h-full w-full items-center justify-center p-6">
            {isMobile && (
                <div className="absolute top-4 left-4">
                    <SidebarLeftTrigger />
                </div>
            )}
            <div className="text-center space-y-6 max-w-md mx-auto">
                <div>
                    <Icon className={`mx-auto h-12 w-12 ${iconColor}`} />
                </div>
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-foreground tracking-tight">
                        {title}
                    </h3>
                    <p className="text-sm text-muted-foreground/80 dark:text-muted-foreground leading-relaxed">
                        {description}
                    </p>
                </div>
                {action}
            </div>
        </div>
    )
}
