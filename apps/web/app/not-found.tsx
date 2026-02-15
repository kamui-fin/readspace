import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
            <div className="text-center">
                <h1 className="mb-4 text-6xl font-semibold text-primary">
                    404
                </h1>
                <p className="mb-4 text-2xl font-medium">
                    Oops! Page Not Found.
                </p>
                <p className="mb-8 text-muted-foreground">
                    Sorry, the page you are looking for does not exist or has
                    been moved.
                </p>
                <Link
                    href="/"
                    className={cn(buttonVariants({ variant: "default" }))}
                >
                    Go Back Home
                </Link>
            </div>
        </div>
    )
}
