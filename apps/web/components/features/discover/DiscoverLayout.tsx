import { cn } from "@/lib/utils"

interface DiscoverLayoutProps {
    children: React.ReactNode
    centerVertically?: boolean
}

/**
 * Layout wrapper for the discover page
 */
export function DiscoverLayout({
    children,
    centerVertically = false,
}: DiscoverLayoutProps) {
    return (
        <div
            className={cn(
                "flex flex-col flex-1",
                centerVertically && "h-full overflow-hidden"
            )}
        >
            <main
                className={cn(
                    "flex-1 px-4 py-4 md:px-6 md:py-6",
                    centerVertically &&
                        "flex items-center justify-center overflow-hidden"
                )}
            >
                {children}
            </main>
        </div>
    )
}
